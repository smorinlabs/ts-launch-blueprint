// Repository interface (repository layer): the only way services reach
// project data. Implementations: HTTP (http-projects.repository.ts) and
// in-memory (in-memory-projects.repository.ts); both pass the shared
// contract suite, so either can be swapped in without touching callers.
import type { Project, Workspace } from '../schemas/project.schema.js';

/** Query for listProjects. Data access only: no name lookup, and no
 * default limit (the caller always passes one). */
export interface ListProjectsQuery {
  /** Only projects in this workspace; omit for all projects. */
  workspaceGid?: string | undefined;
  /** Maximum number of projects to return. */
  limit: number;
}

/** Data access for workspaces and projects. */
export interface ProjectsRepository {
  listWorkspaces(): Promise<Workspace[]>;
  listProjects(query: ListProjectsQuery): Promise<Project[]>;
}
