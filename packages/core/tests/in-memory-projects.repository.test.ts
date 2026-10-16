// In-memory repository: default seed, gid filter, limit, and copy safety.
import { describe, expect, it } from 'vitest';

import {
  createInMemoryProjectsRepository,
  DEFAULT_IN_MEMORY_SEED,
} from '../src/repositories/in-memory-projects.repository.js';

describe('in-memory repository', () => {
  it('serves the default seed with no network and no token', async () => {
    const repository = createInMemoryProjectsRepository();
    expect(await repository.listWorkspaces()).toEqual(DEFAULT_IN_MEMORY_SEED.workspaces);
    expect(await repository.listProjects({ limit: 100 })).toEqual(DEFAULT_IN_MEMORY_SEED.projects);
    expect(DEFAULT_IN_MEMORY_SEED.workspaces).toHaveLength(2);
    expect(DEFAULT_IN_MEMORY_SEED.projects.length).toBeGreaterThanOrEqual(3);
  });

  it('filters projects by workspace gid', async () => {
    const projects = await createInMemoryProjectsRepository().listProjects({
      workspaceGid: 'ws-2',
      limit: 100,
    });
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.every((project) => project.workspace.name === 'Marketing')).toBe(true);
  });

  it('returns no projects for an unknown gid', async () => {
    expect(
      await createInMemoryProjectsRepository().listProjects({ workspaceGid: 'nope', limit: 100 })
    ).toEqual([]);
  });

  it('applies the limit', async () => {
    expect(await createInMemoryProjectsRepository().listProjects({ limit: 2 })).toHaveLength(2);
  });

  it('returns copies, so callers cannot change the stored data', async () => {
    const repository = createInMemoryProjectsRepository();
    const [workspace] = await repository.listWorkspaces();
    const [project] = await repository.listProjects({ limit: 1 });
    workspace!.name = 'Changed';
    project!.workspace.name = 'Changed';
    expect((await repository.listWorkspaces())[0]!.name).toBe('Engineering');
    expect((await repository.listProjects({ limit: 1 }))[0]!.workspace.name).toBe('Engineering');
  });

  it('does not share state with the seed it was given', async () => {
    const seed = structuredClone(DEFAULT_IN_MEMORY_SEED);
    const repository = createInMemoryProjectsRepository(seed);
    seed.workspaces[0]!.name = 'Changed';
    expect((await repository.listWorkspaces())[0]!.name).toBe('Engineering');
  });
});
