// API client for the fictional projects service — port of PyClient
// (py_launch_blueprint/projects.py:150-249). The only HTTP transport
// seam is the injected fetchImpl (D-019(5)); no request library.
//
// Error mapping (D-016(2), cli-standards R6.1): workspace-not-found ->
// NotFoundError (exit 3, unchanged from source); HTTP 401/403 ->
// AuthError (exit 4; the source folded these into PyError -> exit 3);
// every other HTTP/network/timeout/malformed-response failure ->
// ApiError (exit 1; the source used exit 3). Error text mirrors the
// source's "API request failed: <errors[0].message>" surfacing
// (projects.py:191-205).
import { ApiError, AuthError, NotFoundError } from '../core/schemas/errors.js';
import { toProjects, toWorkspaces } from '../core/schemas/project.converter.js';
import type { Project, Workspace } from '../core/schemas/project.schema.js';

/** Placeholder API root, mirroring the source's fictional service
 * (projects.py:154: https://app.py.com/api/1.0). Overridable per client
 * for tests/e2e via ApiClientOptions.baseUrl (wired to the
 * TS_PROJECTS_API_URL env var by the projects command). */
export const BASE_URL = 'https://app.ts.com/api/1.0';

/** Source default page size/limit (projects.py:217,322). The source has
 * no client-side pagination: `limit` is forwarded as a single request
 * parameter and the API returns at most that many projects. */
export const DEFAULT_LIMIT = 200;

/** Default request timeout. The source (requests) had none; a hung
 * placeholder API should fail loudly rather than hang the CLI. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Constructor inputs; fetchImpl is the injected transport seam. */
export interface ApiClientOptions {
  token: string;
  fetchImpl: typeof fetch;
  /** API root override (default BASE_URL). */
  baseUrl?: string | undefined;
  /** Per-request timeout in milliseconds (default 30s). */
  timeoutMs?: number | undefined;
}

/** Client surface (PyClient parity: get_workspaces/get_projects). */
export interface ApiClient {
  getWorkspaces: () => Promise<Workspace[]>;
  getProjects: (options?: {
    workspaceName?: string | undefined;
    limit?: number | undefined;
  }) => Promise<Project[]>;
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

/** Create the API client (PyClient.__init__ parity: Bearer token +
 * Accept header on every request, projects.py:156-169). */
export function createApiClient(options: ApiClientOptions): ApiClient {
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
    async getWorkspaces(): Promise<Workspace[]> {
      return toWorkspaces(await request('/workspaces'));
    },

    // get_projects parity (projects.py:216-247): limit + opt_fields
    // params; optional case-insensitive workspace-name -> gid filter.
    async getProjects(opts?: {
      workspaceName?: string | undefined;
      limit?: number | undefined;
    }): Promise<Project[]> {
      const params: Record<string, string> = {
        limit: String(opts?.limit ?? DEFAULT_LIMIT),
        opt_fields: 'name,workspace.name',
      };
      const workspaceName = opts?.workspaceName;
      if (workspaceName !== undefined && workspaceName !== '') {
        const workspaces = await this.getWorkspaces();
        const workspace = workspaces.find(
          (candidate) => candidate.name.toLowerCase() === workspaceName.toLowerCase()
        );
        if (workspace === undefined) {
          // Exit 3 (not-found) — same code as the source, by design.
          throw new NotFoundError(`Workspace not found: ${workspaceName}`);
        }
        params['workspace'] = workspace.gid;
      }
      return toProjects(await request('/projects', params));
    },
  };
}
