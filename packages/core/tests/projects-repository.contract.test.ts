// Shared ProjectsRepository contract: the same cases run against both
// implementations with the same seed, proving they can be swapped.
//
// What the HTTP run proves (and doesn't): the fake fetchImpl below does the
// filtering, limiting, cursor slicing, and single-item lookup itself, with the
// same logic as the in-memory repository. So a green HTTP run proves the HTTP
// repository SENDS THE RIGHT PARAMS and READS THE RESPONSE CORRECTLY. It does
// NOT prove a real server filters or limits the same way.
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
    { id: '4', name: 'Four', workspace: null },
  ],
};

/** A fake upstream serving SEED; honours workspace, limit, offset, and /projects/:id. */
const fakeFetch = ((input: URL) => {
  if (input.pathname.endsWith('/workspaces')) {
    return Promise.resolve(Response.json({ data: SEED.workspaces }));
  }
  const projectMatch = /\/projects\/([^/]+)$/.exec(input.pathname);
  if (projectMatch !== null) {
    const id = decodeURIComponent(projectMatch[1]!);
    const found = SEED.projects.find((candidate) => candidate.id === id);
    if (found === undefined) {
      return Promise.resolve(
        Response.json({ errors: [{ message: 'Not found' }] }, { status: 404 })
      );
    }
    return Promise.resolve(Response.json({ data: found }));
  }

  const gid = input.searchParams.get('workspace');
  const limit = Number(input.searchParams.get('limit'));
  const offsetParam = input.searchParams.get('offset');
  const offset = offsetParam === null ? 0 : Number(offsetParam);
  let projects = SEED.projects;
  if (gid !== null) {
    const workspace = SEED.workspaces.find((candidate) => candidate.gid === gid);
    projects =
      workspace === undefined
        ? []
        : projects.filter((project) => project.workspace?.name === workspace.name);
  }
  const page =
    Number.isInteger(offset) && offset >= 0 ? projects.slice(offset, offset + limit) : [];
  const nextOffset = offset + limit;
  const nextPage =
    Number.isInteger(offset) && offset >= 0 && nextOffset < projects.length && page.length > 0
      ? { offset: String(nextOffset) }
      : null;
  return Promise.resolve(Response.json({ data: page, next_page: nextPage }));
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
    expect(await create().listProjects({ limit: 100 })).toEqual({
      projects: SEED.projects,
      nextCursor: null,
    });
  });

  it('filters projects by workspace gid', async () => {
    expect(await create().listProjects({ workspaceGid: 'ws-a', limit: 100 })).toEqual({
      projects: [SEED.projects[0], SEED.projects[2]],
      nextCursor: null,
    });
  });

  it('returns no projects for an unknown gid', async () => {
    expect(await create().listProjects({ workspaceGid: 'nope', limit: 100 })).toEqual({
      projects: [],
      nextCursor: null,
    });
  });

  it('paginates with limit and cursor across all items', async () => {
    const repo = create();
    const first = await repo.listProjects({ limit: 2 });
    expect(first.projects).toEqual(SEED.projects.slice(0, 2));
    expect(first.nextCursor).not.toBeNull();

    const second = await repo.listProjects({ limit: 2, cursor: first.nextCursor! });
    expect(second).toEqual({
      projects: SEED.projects.slice(2, 4),
      nextCursor: null,
    });
  });

  it('gets an existing project by id and returns null when absent', async () => {
    const repo = create();
    expect(await repo.getProject('4')).toEqual(SEED.projects[3]);
    expect(await repo.getProject('missing')).toBeNull();
  });
});
