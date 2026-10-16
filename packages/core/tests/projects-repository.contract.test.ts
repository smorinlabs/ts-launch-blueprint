// Shared ProjectsRepository contract: the same cases run against both
// implementations with the same seed, proving they can be swapped.
//
// What the HTTP run proves (and doesn't): the fake fetchImpl below does the
// filtering and limiting itself, with the same logic as the in-memory
// repository. So a green HTTP run proves the HTTP repository SENDS THE RIGHT
// PARAMS and READS THE RESPONSE CORRECTLY. It does NOT prove a real server
// filters or limits the same way.
import { describe, expect, it } from 'vitest';

import { createHttpProjectsRepository } from '../src/repositories/http-projects.repository.js';
import {
  createInMemoryProjectsRepository,
  type InMemoryProjectsSeed,
} from '../src/repositories/in-memory-projects.repository.js';
import type { ProjectsRepository } from '../src/repositories/projects.repository.js';

const SEED: InMemoryProjectsSeed = {
  workspaces: [
    { gid: 'ws-a', name: 'Alpha' },
    { gid: 'ws-b', name: 'Beta' },
  ],
  projects: [
    { id: '1', name: 'One', workspace: { name: 'Alpha' } },
    { id: '2', name: 'Two', workspace: { name: 'Beta' } },
    { id: '3', name: 'Three', workspace: { name: 'Alpha' } },
  ],
};

/** A fake upstream serving SEED; honours the `workspace` and `limit` params. */
const fakeFetch = ((input: URL) => {
  if (input.pathname.endsWith('/workspaces')) {
    return Promise.resolve(Response.json({ data: SEED.workspaces }));
  }
  const gid = input.searchParams.get('workspace');
  const limit = Number(input.searchParams.get('limit'));
  let projects = SEED.projects;
  if (gid !== null) {
    const workspace = SEED.workspaces.find((candidate) => candidate.gid === gid);
    projects =
      workspace === undefined
        ? []
        : projects.filter((project) => project.workspace.name === workspace.name);
  }
  return Promise.resolve(Response.json({ data: projects.slice(0, limit) }));
}) as unknown as typeof fetch;

const IMPLEMENTATIONS: [string, () => ProjectsRepository][] = [
  ['in-memory', () => createInMemoryProjectsRepository(SEED)],
  ['http', () => createHttpProjectsRepository({ token: 't', fetchImpl: fakeFetch })],
];

describe.each(IMPLEMENTATIONS)('ProjectsRepository contract: %s', (_name, create) => {
  it('lists workspaces', async () => {
    expect(await create().listWorkspaces()).toEqual(SEED.workspaces);
  });

  it('lists all projects', async () => {
    expect(await create().listProjects({ limit: 100 })).toEqual(SEED.projects);
  });

  it('filters projects by workspace gid', async () => {
    expect(await create().listProjects({ workspaceGid: 'ws-a', limit: 100 })).toEqual([
      SEED.projects[0],
      SEED.projects[2],
    ]);
  });

  it('returns no projects for an unknown gid', async () => {
    expect(await create().listProjects({ workspaceGid: 'nope', limit: 100 })).toEqual([]);
  });

  it('respects the limit', async () => {
    expect(await create().listProjects({ limit: 2 })).toEqual(SEED.projects.slice(0, 2));
  });
});
