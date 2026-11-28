// Projects service (service layer): the business rules every controller
// calls (the CLI and the API). It reaches data only through a
// ProjectsRepository, so it runs the same over HTTP or in-memory data.
import type { ProjectsRepository } from '../repositories/projects.repository.js';
import { NotFoundError } from '../schemas/errors.js';
import type { Project } from '../schemas/project.schema.js';
import type { ListProjectsOutput } from '../schemas/projects.contract.js';

/** Source default page size/limit (projects.py:217,322). Core and CLI stay
 * uncapped; apps/api enforces MAX_API_LIMIT (Q7.A). */
export const DEFAULT_LIMIT = 200;

/** Input for listProjects. */
export interface ListProjectsInput {
  /** Workspace name, matched case-insensitively; empty or missing means
   * no filter. */
  workspaceName?: string | undefined;
  /** Maximum number of projects (default DEFAULT_LIMIT). */
  limit?: number | undefined;
  /** Opaque pagination cursor from a previous `nextCursor`. */
  cursor?: string | undefined;
}

/** Project use cases. */
export interface ProjectsService {
  listProjects(input?: ListProjectsInput): Promise<ListProjectsOutput>;
  getProject(id: string): Promise<Project>;
}

/** Create the projects service over a repository. */
export function createProjectsService(deps: { repository: ProjectsRepository }): ProjectsService {
  const { repository } = deps;

  return {
    async listProjects(input?: ListProjectsInput): Promise<ListProjectsOutput> {
      let workspaceGid: string | undefined;
      const workspaceName = input?.workspaceName;
      if (workspaceName !== undefined && workspaceName !== '') {
        const workspaces = await repository.listWorkspaces();
        const workspace = workspaces.find(
          (candidate) => candidate.name.toLowerCase() === workspaceName.toLowerCase()
        );
        if (workspace === undefined) {
          throw new NotFoundError(`Workspace not found: ${workspaceName}`);
        }
        workspaceGid = workspace.gid;
      }
      return repository.listProjects({
        workspaceGid,
        limit: input?.limit ?? DEFAULT_LIMIT,
        ...(input?.cursor !== undefined ? { cursor: input.cursor } : {}),
      });
    },

    async getProject(id: string): Promise<Project> {
      const project = await repository.getProject(id);
      if (project === null) {
        throw new NotFoundError(`Project not found: ${id}`);
      }
      return project;
    },
  };
}
