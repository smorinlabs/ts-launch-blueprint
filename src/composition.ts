// Composition root: the only place that chooses implementations. It picks
// a ProjectsRepository (HTTP or in-memory) and builds the services on it;
// controllers ask for a Core instead of wiring infrastructure themselves.
// Moves into packages/core in P1-5.
import {
  createHttpProjectsRepository,
  type HttpProjectsRepositoryOptions,
} from './core/repositories/http-projects.repository.js';
import {
  createInMemoryProjectsRepository,
  type InMemoryProjectsSeed,
} from './core/repositories/in-memory-projects.repository.js';
import type { ProjectsRepository } from './core/repositories/projects.repository.js';
import { createProjectsService, type ProjectsService } from './core/services/projects.service.js';

/** Which data source the core runs on. */
export type CoreConfig =
  | { source: 'http'; http: HttpProjectsRepositoryOptions }
  | { source: 'memory'; seed?: InMemoryProjectsSeed | undefined };

/** The services a controller can call. */
export interface Core {
  projects: ProjectsService;
}

/** Build the core on the configured data source. */
export function createCore(config: CoreConfig): Core {
  const repository: ProjectsRepository =
    config.source === 'http'
      ? createHttpProjectsRepository(config.http)
      : createInMemoryProjectsRepository(config.seed);
  return { projects: createProjectsService({ repository }) };
}
