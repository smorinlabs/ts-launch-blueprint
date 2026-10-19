import { TRPCError } from '@trpc/server';
// projects.list through tRPC's server-side caller (no HTTP): the same
// projects service as the CLI, over the in-memory demo data.
import {
  createCore,
  DEFAULT_IN_MEMORY_SEED,
  ListProjectsOutputSchema,
} from '@ts-launch-blueprint/core';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../src/router.js';

const caller = appRouter.createCaller({ core: createCore({ source: 'memory' }) });
const ENGINEERING = DEFAULT_IN_MEMORY_SEED.projects.filter(
  (project) => project.workspace.name === 'Engineering'
);

describe('projects.list (tRPC caller)', () => {
  it('lists the 4 demo projects with no input', async () => {
    expect(await caller.projects.list()).toEqual({ projects: DEFAULT_IN_MEMORY_SEED.projects });
    expect(await caller.projects.list(undefined)).toEqual({
      projects: DEFAULT_IN_MEMORY_SEED.projects,
    });
  });

  it('filters by workspace name, case-insensitively', async () => {
    expect(await caller.projects.list({ workspaceName: 'engineering' })).toEqual({
      projects: ENGINEERING,
    });
  });

  it('applies the limit', async () => {
    expect((await caller.projects.list({ limit: 1 })).projects).toHaveLength(1);
  });

  it('rejects limit 0 with BAD_REQUEST (the core contract validates input)', async () => {
    await expect(caller.projects.list({ limit: 0 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(caller.projects.list({ limit: 0 })).rejects.toBeInstanceOf(TRPCError);
  });

  it('returns output that matches the core contract', async () => {
    expect(ListProjectsOutputSchema.safeParse(await caller.projects.list()).success).toBe(true);
  });
});
