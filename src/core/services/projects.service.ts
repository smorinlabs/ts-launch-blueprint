// Projects service (service layer): the business rules every controller
// calls (the CLI now, the API in Phase 2). It reaches data only through a
// ProjectsRepository, so it runs the same over HTTP or in-memory data.
import type { ProjectsRepository } from '../repositories/projects.repository.js';
import { NotFoundError } from '../schemas/errors.js';
import type { Project } from '../schemas/project.schema.js';

/** Source default page size/limit (projects.py:217,322). The source has
 * no client-side pagination: `limit` is forwarded as a single request
 * parameter and the API returns at most that many projects. */
export const DEFAULT_LIMIT = 200;

/** Input for listProjects. */
export interface ListProjectsInput {
  /** Workspace name, matched case-insensitively; empty or missing means
   * no filter. */
  workspaceName?: string | undefined;
  /** Maximum number of projects (default DEFAULT_LIMIT). */
  limit?: number | undefined;
}

/** Project use cases. */
export interface ProjectsService {
  listProjects(input?: ListProjectsInput): Promise<Project[]>;
}

/** Create the projects service over a repository. */
export function createProjectsService(deps: { repository: ProjectsRepository }): ProjectsService {
  const { repository } = deps;

  return {
    // get_projects parity (projects.py:216-247): optional case-insensitive
    // workspace-name -> gid filter; an empty name means no filter.
    async listProjects(input?: ListProjectsInput): Promise<Project[]> {
      let workspaceGid: string | undefined;
      const workspaceName = input?.workspaceName;
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
      return repository.listProjects({ workspaceGid, limit: input?.limit ?? DEFAULT_LIMIT });
    },
  };
}
