// In-memory projects repository: no network, no token, no errors. Serves a
// seed (a built-in demo set by default) so the CLI, the future API, and
// tests can run without the placeholder upstream service.
import type { Project, Workspace } from '../schemas/project.schema.js';
import type { ListProjectsQuery, ProjectsRepository } from './projects.repository.js';

/** Data an in-memory repository serves. */
export interface InMemoryProjectsSeed {
  workspaces: Workspace[];
  projects: Project[];
}

/** Built-in demo data: two workspaces, projects spread across both. */
export const DEFAULT_IN_MEMORY_SEED: InMemoryProjectsSeed = {
  workspaces: [
    { gid: 'ws-1', name: 'Engineering' },
    { gid: 'ws-2', name: 'Marketing' },
  ],
  projects: [
    { id: 'p-1', name: 'API Platform', workspace: { name: 'Engineering' } },
    { id: 'p-2', name: 'Mobile App', workspace: { name: 'Engineering' } },
    { id: 'p-3', name: 'Website Redesign', workspace: { name: 'Marketing' } },
    { id: 'p-4', name: 'Launch Campaign', workspace: { name: 'Marketing' } },
  ],
};

/** Create an in-memory repository over `seed`. Returned objects are copies,
 * so callers can't change the stored data. */
export function createInMemoryProjectsRepository(
  seed: InMemoryProjectsSeed = DEFAULT_IN_MEMORY_SEED
): ProjectsRepository {
  const store = structuredClone(seed);

  return {
    listWorkspaces(): Promise<Workspace[]> {
      return Promise.resolve(structuredClone(store.workspaces));
    },

    listProjects(query: ListProjectsQuery): Promise<Project[]> {
      let projects = store.projects;
      if (query.workspaceGid !== undefined) {
        // Project carries only its workspace name, so resolve gid -> name.
        const workspace = store.workspaces.find(
          (candidate) => candidate.gid === query.workspaceGid
        );
        projects =
          workspace === undefined
            ? []
            : projects.filter((project) => project.workspace.name === workspace.name);
      }
      return Promise.resolve(structuredClone(projects.slice(0, query.limit)));
    },
  };
}
