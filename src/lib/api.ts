// API client — compatibility wrapper over the HTTP projects repository
// (src/core/repositories/http-projects.repository.ts) and the projects
// service (src/core/services/projects.service.ts); kept because
// createApiClient is public API (D-012(3)); candidate for removal in the
// public-API cleanup. No business rules live here.
import {
  createHttpProjectsRepository,
  type HttpProjectsRepositoryOptions,
} from '../core/repositories/http-projects.repository.js';
import type { Project, Workspace } from '../core/schemas/project.schema.js';
import { createProjectsService } from '../core/services/projects.service.js';

export { BASE_URL, DEFAULT_TIMEOUT_MS } from '../core/repositories/http-projects.repository.js';
export { DEFAULT_LIMIT } from '../core/services/projects.service.js';

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

/** Create the API client (PyClient parity) over the repository + service. */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const repository = createHttpProjectsRepository(options);
  const service = createProjectsService({ repository });

  return {
    // Plain data access with no business rule, so it goes straight to the
    // repository rather than through the service.
    getWorkspaces: () => repository.listWorkspaces(),
    getProjects: (opts) => service.listProjects(opts),
  };
}
