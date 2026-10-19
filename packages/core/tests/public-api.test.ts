// Locks the public surface of @ts-launch-blueprint/core (src/index.ts), the
// only entry apps may import. Changing either list below is a deliberate
// change to the core's public API.
import { describe, expect, it } from 'vitest';

import * as core from '../src/index.js';
import type {
  Core,
  CoreConfig,
  HttpProjectsRepositoryOptions,
  InMemoryProjectsSeed,
  ListProjectsInput,
  ListProjectsOutput,
  ListProjectsQuery,
  Project,
  ProjectsRepository,
  ProjectsService,
  Workspace,
} from '../src/index.js';

describe('core public API surface', () => {
  it('src/index.ts exports exactly the expected runtime names', () => {
    // Sorted in place: tsconfig's ES2022 lib has no toSorted(), and
    // unicorn(no-array-sort) only allows sort() as its own statement.
    const names = Object.keys(core);
    names.sort();
    expect(names).toEqual([
      'ApiError',
      'AuthError',
      'BASE_URL',
      'ConflictError',
      'DEFAULT_IN_MEMORY_SEED',
      'DEFAULT_LIMIT',
      'DEFAULT_TIMEOUT_MS',
      'DomainError',
      'ListProjectsInputSchema',
      'ListProjectsOutputSchema',
      'NotFoundError',
      'createCore',
      'createHttpProjectsRepository',
      'createInMemoryProjectsRepository',
      'createProjectsService',
    ]);
  });

  it('src/index.ts exports the expected types', () => {
    // Compile-time guard: this file fails `tsc --noEmit` if any type above is
    // removed or renamed. The tuple below just marks the imports as used.
    type _Surface = [
      Core,
      CoreConfig,
      HttpProjectsRepositoryOptions,
      InMemoryProjectsSeed,
      ListProjectsInput,
      ListProjectsOutput,
      ListProjectsQuery,
      Project,
      ProjectsRepository,
      ProjectsService,
      Workspace,
    ];
    expect(true).toBe(true);
  });
});
