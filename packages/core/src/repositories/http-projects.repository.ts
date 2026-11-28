// HTTP projects repository for the fictional projects service — port of
// PyClient's transport (py_launch_blueprint/projects.py:150-249). The only
// HTTP transport seam is the injected fetchImpl (D-019(5)); no request
// library.
//
// Error mapping (D-016(2), cli-standards R6.1): HTTP 401/403 -> AuthError
// (exit 4; the source folded these into PyError -> exit 3); every other
// HTTP/network/timeout/malformed-response failure -> ApiError (exit 1;
// the source used exit 3). Error text mirrors the source's "API request
// failed: <errors[0].message>" surfacing (projects.py:191-205).
//
// Data access only: no workspace-name lookup and no default limit. Those
// are business rules (the projects service).
import { ApiError, AuthError } from '../schemas/errors.js';
import {
  convertProjectDetailed,
  convertWorkspaceDetailed,
  type DetailedConvertResult,
} from '../schemas/project.converter.js';
import type { Project, Workspace } from '../schemas/project.schema.js';
import type { ListProjectsOutput } from '../schemas/projects.contract.js';
import type { ListProjectsQuery, ProjectsRepository } from './projects.repository.js';

/** Placeholder API root, mirroring the source's fictional service
 * (projects.py:154: https://app.py.com/api/1.0). Overridable per client
 * for tests/e2e via the baseUrl option (wired to the TS_PROJECTS_API_URL
 * env var by the projects command). */
export const BASE_URL = 'https://app.ts.com/api/1.0';

/** Default request timeout. The source (requests) had none; a hung
 * placeholder API should fail loudly rather than hang the CLI. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Constructor inputs; fetchImpl is the injected transport seam. */
export interface HttpProjectsRepositoryOptions {
  token: string;
  fetchImpl: typeof fetch;
  /** API root override (default BASE_URL). */
  baseUrl?: string | undefined;
  /** Per-request timeout in milliseconds (default 30s). */
  timeoutMs?: number | undefined;
}

/** Pull the API's own error message out of a failure body, mirroring
 * projects.py:192-204 (errors[0].message, falling back to the raw
 * failure description). */
async function errorMessage(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status} ${response.statusText}`.trim();
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'errors' in body) {
      const errors = (body as { errors: unknown }).errors;
      if (Array.isArray(errors) && errors.length > 0) {
        const first: unknown = errors[0];
        if (typeof first === 'object' && first !== null && 'message' in first) {
          const message = (first as { message: unknown }).message;
          if (typeof message === 'string') {
            return message;
          }
        }
      }
    }
  } catch {
    // Non-JSON error body: fall through to the HTTP status fallback.
  }
  return fallback;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Strict boundary validation (Py P04 parity): missing `data` is schema drift
// (ApiError), never an empty list. Collects all item issues across the array
// so errors locate `data.<index>.<field>` + `(+N more)` without echoing values.
function unwrapList<T>(
  body: unknown,
  endpoint: string,
  convert: (raw: unknown) => DetailedConvertResult<T>
): T[] {
  if (!isPlainObject(body)) {
    throw new ApiError(`API request failed: unexpected ${endpoint} response shape`);
  }
  const data = body['data'];
  if (!Array.isArray(data)) {
    throw new ApiError(`API request failed: unexpected ${endpoint} response shape`);
  }

  const values: T[] = [];
  let firstFailure: { index: number; firstProblem: string; firstPath: string } | undefined;
  let totalIssues = 0;

  for (let index = 0; index < data.length; index += 1) {
    const result = convert(data[index]);
    if (result.ok) {
      values.push(result.value);
    } else {
      totalIssues += result.issueCount;
      if (firstFailure === undefined) {
        firstFailure = {
          index,
          firstProblem: result.firstProblem,
          firstPath: result.firstPath,
        };
      }
    }
  }

  if (firstFailure !== undefined) {
    const dataPath =
      firstFailure.firstPath === ''
        ? `data.${firstFailure.index}`
        : `data.${firstFailure.index}.${firstFailure.firstPath}`;
    const remainder = totalIssues > 1 ? ` (+${totalIssues - 1} more)` : '';
    throw new ApiError(
      `API request failed: unexpected ${endpoint} item at index ${firstFailure.index}: ${firstFailure.firstProblem} (${dataPath})${remainder}`
    );
  }

  return values;
}

function unwrapItem<T>(
  body: unknown,
  endpoint: string,
  convert: (raw: unknown) => DetailedConvertResult<T>
): T {
  if (!isPlainObject(body)) {
    throw new ApiError(`API request failed: unexpected ${endpoint} response shape`);
  }
  const data = body['data'];
  if (!isPlainObject(data)) {
    throw new ApiError(`API request failed: unexpected ${endpoint} response shape`);
  }
  const result = convert(data);
  if (!result.ok) {
    throw new ApiError(`API request failed: unexpected ${endpoint} item: ${result.problem}`);
  }
  return result.value;
}

function extractNextCursor(body: unknown): string | null {
  if (!isPlainObject(body) || body['next_page'] === undefined || body['next_page'] === null) {
    return null;
  }
  const nextPage = body['next_page'];
  if (!isPlainObject(nextPage)) {
    throw new ApiError('API request failed: unexpected /projects next_page shape');
  }
  const offset = nextPage['offset'];
  if (offset === undefined || offset === null) {
    return null;
  }
  if (typeof offset !== 'string' || offset.length === 0) {
    throw new ApiError('API request failed: unexpected /projects next_page shape');
  }
  return offset;
}

/** Strip trailing slashes without a regex: `/\/+$/` backtracks
 * quadratically on long runs of '/' (CodeQL js/polynomial-redos). */
function trimTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url.charCodeAt(end - 1) === 47 /* '/' */) {
    end -= 1;
  }
  return url.slice(0, end);
}

/** Create the HTTP repository (PyClient.__init__ parity: Bearer token +
 * Accept header on every request, projects.py:156-169). */
export function createHttpProjectsRepository(
  options: HttpProjectsRepositoryOptions
): ProjectsRepository {
  const baseUrl = trimTrailingSlashes(options.baseUrl ?? BASE_URL);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = {
    Authorization: `Bearer ${options.token}`,
    Accept: 'application/json',
  };

  async function request(
    path: string,
    params?: Record<string, string>,
    requestOptions?: { allowNotFound?: boolean }
  ): Promise<unknown> {
    const url = new URL(`${baseUrl}/${path.replace(/^\/+/, '')}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, value);
    }
    let response: Response;
    try {
      response = await options.fetchImpl(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new ApiError(`API request timed out after ${timeoutMs}ms: ${url.toString()}`);
      }
      throw new ApiError(`API request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!response.ok) {
      if (requestOptions?.allowNotFound === true && response.status === 404) {
        return undefined;
      }
      const message = await errorMessage(response);
      if (response.status === 401 || response.status === 403) {
        // Invalid/rejected token -> auth, exit 4 (D-016(2)).
        throw new AuthError(`API authentication failed: ${message}`);
      }
      throw new ApiError(`API request failed: ${message}`);
    }
    try {
      return await response.json();
    } catch {
      throw new ApiError(`API request failed: malformed JSON response from ${url.toString()}`);
    }
  }

  return {
    async listWorkspaces(): Promise<Workspace[]> {
      return unwrapList(await request('/workspaces'), '/workspaces', convertWorkspaceDetailed);
    },

    async listProjects(query: ListProjectsQuery): Promise<ListProjectsOutput> {
      const params: Record<string, string> = {
        limit: String(query.limit),
        opt_fields: 'name,workspace.name',
      };
      if (query.workspaceGid !== undefined) {
        params['workspace'] = query.workspaceGid;
      }
      if (query.cursor !== undefined) {
        params['offset'] = query.cursor;
      }
      const body = await request('/projects', params);
      const projects = unwrapList(body, '/projects', convertProjectDetailed);
      const nextCursor = extractNextCursor(body);
      return { projects, nextCursor };
    },

    async getProject(id: string): Promise<Project | null> {
      const body = await request(
        `/projects/${encodeURIComponent(id)}`,
        { opt_fields: 'name,workspace.name' },
        { allowNotFound: true }
      );
      if (body === undefined) {
        return null;
      }
      return unwrapItem(body, '/projects/:id', convertProjectDetailed);
    },
  };
}
