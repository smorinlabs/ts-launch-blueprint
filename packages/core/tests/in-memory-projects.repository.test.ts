// In-memory repository: default seed, gid filter, limit, cursor pagination,
// getProject, and copy safety.
import { describe, expect, it } from 'vitest';

import {
  createInMemoryProjectsRepository,
  DEFAULT_IN_MEMORY_SEED,
} from '../src/repositories/in-memory-projects.repository.js';

describe('in-memory repository', () => {
  it('serves the default seed with no network and no token', async () => {
    const repository = createInMemoryProjectsRepository();
    expect(await repository.listWorkspaces()).toEqual(DEFAULT_IN_MEMORY_SEED.workspaces);
    expect(await repository.listProjects({ limit: 100 })).toEqual({
      projects: DEFAULT_IN_MEMORY_SEED.projects,
      nextCursor: null,
    });
    expect(DEFAULT_IN_MEMORY_SEED.workspaces).toHaveLength(2);
    expect(DEFAULT_IN_MEMORY_SEED.projects.length).toBeGreaterThanOrEqual(3);
  });

  it('filters projects by workspace gid and handles null workspace cleanly', async () => {
    const repository = createInMemoryProjectsRepository({
      workspaces: DEFAULT_IN_MEMORY_SEED.workspaces,
      projects: [
        ...DEFAULT_IN_MEMORY_SEED.projects,
        { id: 'p-null', name: 'Unassigned', workspace: null },
      ],
    });
    const { projects } = await repository.listProjects({
      workspaceGid: 'ws-2',
      limit: 100,
    });
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.every((project) => project.workspace?.name === 'Marketing')).toBe(true);
    expect(projects.some((project) => project.id === 'p-null')).toBe(false);
  });

  it('returns no projects for an unknown gid', async () => {
    expect(
      await createInMemoryProjectsRepository().listProjects({ workspaceGid: 'nope', limit: 100 })
    ).toEqual({ projects: [], nextCursor: null });
  });

  it('paginates with cursor without gaps, duplicates, or trailing empty page', async () => {
    const repository = createInMemoryProjectsRepository();
    const page1 = await repository.listProjects({ limit: 2 });
    expect(page1.projects).toEqual(DEFAULT_IN_MEMORY_SEED.projects.slice(0, 2));
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await repository.listProjects({ limit: 2, cursor: page1.nextCursor! });
    expect(page2.projects).toEqual(DEFAULT_IN_MEMORY_SEED.projects.slice(2, 4));
    expect(page2.nextCursor).toBeNull();
  });

  it('returns empty page for unknown or malformed cursor instead of resetting to offset 0', async () => {
    const repository = createInMemoryProjectsRepository();
    const badCursors = [
      'not-a-valid-cursor',
      Buffer.from('"just-a-string"', 'utf8').toString('base64url'),
      Buffer.from(JSON.stringify({ offset: -1 }), 'utf8').toString('base64url'),
      Buffer.from('{"offset":0,"extra":1}', 'utf8').toString('base64url'),
    ];
    for (const cursor of badCursors) {
      expect(await repository.listProjects({ limit: 2, cursor })).toEqual({
        projects: [],
        nextCursor: null,
      });
    }
  });

  it('gets a single project by id or returns null when absent', async () => {
    const repository = createInMemoryProjectsRepository();
    expect(await repository.getProject('p-2')).toEqual(DEFAULT_IN_MEMORY_SEED.projects[1]);
    expect(await repository.getProject('missing')).toBeNull();
  });

  it('returns copies, so callers cannot change the stored data', async () => {
    const repository = createInMemoryProjectsRepository();
    const [workspace] = await repository.listWorkspaces();
    const { projects } = await repository.listProjects({ limit: 1 });
    const fetched = await repository.getProject('p-1');
    workspace!.name = 'Changed';
    projects[0]!.workspace!.name = 'Changed';
    fetched!.name = 'Mutated';
    expect((await repository.listWorkspaces())[0]!.name).toBe('Engineering');
    expect((await repository.listProjects({ limit: 1 })).projects[0]!.workspace?.name).toBe(
      'Engineering'
    );
    expect((await repository.getProject('p-1'))?.name).toBe('API Platform');
  });

  it('does not share state with the seed it was given', async () => {
    const seed = structuredClone(DEFAULT_IN_MEMORY_SEED);
    const repository = createInMemoryProjectsRepository(seed);
    seed.workspaces[0]!.name = 'Changed';
    expect((await repository.listWorkspaces())[0]!.name).toBe('Engineering');
  });
});
