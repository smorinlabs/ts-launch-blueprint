// Public entry of the shared core library (@ts-launch-blueprint/core). Apps
// import the core only through this file, never through ./src/... paths.
// Converters and Zod schemas stay internal. Locked by tests/public-api.test.ts.
export { type Core, type CoreConfig, createCore } from './composition.js';
export {
  BASE_URL,
  createHttpProjectsRepository,
  DEFAULT_TIMEOUT_MS,
  type HttpProjectsRepositoryOptions,
} from './repositories/http-projects.repository.js';
export {
  createInMemoryProjectsRepository,
  DEFAULT_IN_MEMORY_SEED,
  type InMemoryProjectsSeed,
} from './repositories/in-memory-projects.repository.js';
export type { ListProjectsQuery, ProjectsRepository } from './repositories/projects.repository.js';
export {
  ApiError,
  AuthError,
  ConflictError,
  DomainError,
  NotFoundError,
} from './schemas/errors.js';
export type { Project, Workspace } from './schemas/project.schema.js';
export {
  createProjectsService,
  DEFAULT_LIMIT,
  type ListProjectsInput,
  type ProjectsService,
} from './services/projects.service.js';
