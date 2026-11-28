// projects.list and projects.get through tRPC's server-side caller (no HTTP):
// the same projects service as the CLI, over the in-memory demo data.
import { TRPCError } from '@trpc/server';
import {
  createCore,
  DEFAULT_IN_MEMORY_SEED,
  GetProjectOutputSchema,
  ListProjectsOutputSchema,
} from 'ts-launch-blueprint-core';
import { describe, expect, it } from 'vitest';

import { appRouter, MAX_API_LIMIT } from '../src/router.js';

const caller = appRouter.createCaller({ core: createCore({ source: 'memory' }) });
const ENGINEERING = DEFAULT_IN_MEMORY_SEED.projects.filter(
  (project) => project.workspace?.name === 'Engineering'
);

describe('projects.list (tRPC caller)', () => {
  it('lists the 4 demo projects with no input', async () => {
    expect(await caller.projects.list()).toEqual({
      projects: DEFAULT_IN_MEMORY_SEED.projects,
      nextCursor: null,
    });
    expect(await caller.projects.list(undefined)).toEqual({
      projects: DEFAULT_IN_MEMORY_SEED.projects,
      nextCursor: null,
    });
  });

  it('filters by workspace name, case-insensitively', async () => {
    expect(await caller.projects.list({ workspaceName: 'engineering' })).toEqual({
      projects: ENGINEERING,
      nextCursor: null,
    });
  });

  it('paginates with limit and cursor', async () => {
    const page1 = await caller.projects.list({ limit: 2 });
    expect(page1.projects).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await caller.projects.list({ limit: 2, cursor: page1.nextCursor! });
    expect(page2).toEqual({
      projects: DEFAULT_IN_MEMORY_SEED.projects.slice(2, 4),
      nextCursor: null,
    });
  });

  it('enforces MAX_API_LIMIT (100) in apps/api only (Q7.A)', async () => {
    expect(MAX_API_LIMIT).toBe(100);
    await expect(caller.projects.list({ limit: 100 })).resolves.toMatchObject({
      projects: DEFAULT_IN_MEMORY_SEED.projects,
    });
    await expect(caller.projects.list({ limit: 101 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    const largeProjects = Array.from({ length: 120 }, (_, i) => ({
      id: `p-${i + 1}`,
      name: `Project ${i + 1}`,
      workspace: { name: 'Engineering' },
    }));
    const largeCaller = appRouter.createCaller({
      core: createCore({
        source: 'memory',
        seed: { workspaces: [{ gid: 'ws1', name: 'Engineering' }], projects: largeProjects },
      }),
    });
    const defaultPage = await largeCaller.projects.list();
    expect(defaultPage.projects).toHaveLength(MAX_API_LIMIT);
    expect(defaultPage.nextCursor).not.toBeNull();
    const emptyInputPage = await largeCaller.projects.list({});
    expect(emptyInputPage.projects).toHaveLength(MAX_API_LIMIT);
    expect(emptyInputPage.nextCursor).not.toBeNull();
  });

  it('rejects limit 0 with BAD_REQUEST (the core contract validates input)', async () => {
    await expect(caller.projects.list({ limit: 0 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(caller.projects.list({ limit: 0 })).rejects.toBeInstanceOf(TRPCError);
  });

  it('maps an unknown workspace to NOT_FOUND (the middleware runs for the caller too)', async () => {
    await expect(caller.projects.list({ workspaceName: 'nope' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Workspace not found: nope',
    });
  });

  it('returns output that matches the core contract', async () => {
    expect(ListProjectsOutputSchema.safeParse(await caller.projects.list()).success).toBe(true);
  });
});

describe('projects.get (tRPC caller)', () => {
  it('returns a project matching GetProjectOutputSchema', async () => {
    const result = await caller.projects.get({ id: 'p-1' });
    expect(result).toEqual({ project: DEFAULT_IN_MEMORY_SEED.projects[0] });
    expect(GetProjectOutputSchema.safeParse(result).success).toBe(true);
  });

  it('maps missing project to NOT_FOUND', async () => {
    await expect(caller.projects.get({ id: 'missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Project not found: missing',
    });
  });

  it('rejects empty id and dot-segment ids with BAD_REQUEST', async () => {
    await expect(caller.projects.get({ id: '' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(caller.projects.get({ id: '.' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(caller.projects.get({ id: '..' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
