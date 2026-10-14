// API client — compatibility wrapper over the HTTP projects repository
// (src/core/repositories/http-projects.repository.ts), kept because
// createApiClient is public API (D-012(3)). Transport, error mapping and
// response validation live in the repository; this file only adds the
// workspace-name lookup and the default limit. The name lookup moves to
// the service in P1-4.
import {
  createHttpProjectsRepository,
  type HttpProjectsRepositoryOptions,
} from '../core/repositories/http-projects.repository.js';
import { NotFoundError } from '../core/schemas/errors.js';
import type { Project, Workspace } from '../core/schemas/project.schema.js';

export { BASE_URL, DEFAULT_TIMEOUT_MS } from '../core/repositories/http-projects.repository.js';

/** Source default page size/limit (projects.py:217,322). The source has
 * no client-side pagination: `limit` is forwarded as a single request
 * parameter and the API returns at most that many projects. */
export const DEFAULT_LIMIT = 200;

/** Constructor inputs; fetchImpl is the injected transport seam. */
export type ApiClientOptions = HttpProjectsRepositoryOptions;

/** Client surface (PyClient parity: get_workspaces/get_projects). */
export interface ApiClient {
  getWorkspaces: () => Promise<Workspace[]>;
  getProjects: (options?: {
    workspaceName?: string | undefined;
    limit?: number | undefined;
  }) => Promise<Project[]>;
}

/** Create the API client (PyClient parity) over an HTTP repository. */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const repository = createHttpProjectsRepository(options);

  return {
    // get_workspaces parity (projects.py:207-214).
    getWorkspaces: () => repository.listWorkspaces(),

    // get_projects parity (projects.py:216-247): optional case-insensitive
    // workspace-name -> gid filter; an empty name means no filter.
    async getProjects(opts?: {
      workspaceName?: string | undefined;
      limit?: number | undefined;
    }): Promise<Project[]> {
      let workspaceGid: string | undefined;
      const workspaceName = opts?.workspaceName;
      if (workspaceName !== undefined && workspaceName !== '') {
        const workspaces = await repository.listWorkspaces();
        const workspace = workspaces.find(
          (candidate) => candidate.name.toLowerCase() === workspaceName.toLowerCase()
        );
        if (workspace === undefined) {
          // Exit 3 (not-found) — same code as the source, by design.
          throw new NotFoundError(`Workspace not found: ${workspaceName}`);
        }
        workspaceGid = workspace.gid;
      }
      return repository.listProjects({ workspaceGid, limit: opts?.limit ?? DEFAULT_LIMIT });
    },
  };
}
