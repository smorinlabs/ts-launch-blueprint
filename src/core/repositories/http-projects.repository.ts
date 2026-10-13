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
// are business rules (createApiClient today, the service from P1-4).
import { ApiError, AuthError } from '../schemas/errors.js';
import {
  type ConvertResult,
  convertProject,
  convertWorkspace,
} from '../schemas/project.converter.js';
import type { Project, Workspace } from '../schemas/project.schema.js';
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

// The source trusted response shapes (KeyError/implicit any); a typed
// port needs an explicit guard. Shape violations -> ApiError (clean
// exit 1) instead of the source's accidental crash path.
function unwrapList<T>(
  body: unknown,
  endpoint: string,
  convert: (raw: unknown) => ConvertResult<T>
): T[] {
  if (typeof body !== 'object' || body === null) {
    throw new ApiError(`API request failed: unexpected ${endpoint} response shape`);
  }
  const data = (body as { data?: unknown }).data;
  if (data === undefined) {
    // get_projects parity: response_data.get("data", []) tolerates a
    // missing key (projects.py:247).
    return [];
  }
  if (!Array.isArray(data)) {
    throw new ApiError(`API request failed: unexpected ${endpoint} response shape`);
  }
  return data.map((item: unknown, index) => {
    const result = convert(item);
    if (!result.ok) {
      throw new ApiError(
        `API request failed: unexpected ${endpoint} item at index ${index}: ${result.problem}`
      );
    }
    return result.value;
  });
}

/** Create the HTTP repository (PyClient.__init__ parity: Bearer token +
 * Accept header on every request, projects.py:156-169). */
export function createHttpProjectsRepository(
  options: HttpProjectsRepositoryOptions
): ProjectsRepository {
  const baseUrl = (options.baseUrl ?? BASE_URL).replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = {
    Authorization: `Bearer ${options.token}`,
    Accept: 'application/json',
  };

  // _request parity (projects.py:171-205): one wrapper owning URL
  // construction, headers, and failure translation.
  async function request(path: string, params?: Record<string, string>): Promise<unknown> {
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
    // get_workspaces parity (projects.py:207-214).
    async listWorkspaces(): Promise<Workspace[]> {
      return unwrapList(await request('/workspaces'), '/workspaces', convertWorkspace);
    },

    // get_projects parity (projects.py:216-247): limit + opt_fields
    // params, plus the workspace gid filter when one is given.
    async listProjects(query: ListProjectsQuery): Promise<Project[]> {
      const params: Record<string, string> = {
        limit: String(query.limit),
        opt_fields: 'name,workspace.name',
      };
      if (query.workspaceGid !== undefined) {
        params['workspace'] = query.workspaceGid;
      }
      return unwrapList(await request('/projects', params), '/projects', convertProject);
    },
  };
}
