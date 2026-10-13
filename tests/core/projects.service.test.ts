// Projects service: business rules tested over the in-memory repository
// (no fetch mocks). A small spy records what the service asks the
// repository for.
import { describe, expect, it } from 'vitest';

import {
  createInMemoryProjectsRepository,
  DEFAULT_IN_MEMORY_SEED,
} from '../../src/core/repositories/in-memory-projects.repository.js';
import type {
  ListProjectsQuery,
  ProjectsRepository,
} from '../../src/core/repositories/projects.repository.js';
import { NotFoundError } from '../../src/core/schemas/errors.js';
import { createProjectsService, DEFAULT_LIMIT } from '../../src/core/services/projects.service.js';

/** The in-memory repository, wrapped to count and record calls. */
function spiedRepository(): {
  repository: ProjectsRepository;
  workspaceCalls: () => number;
  projectQueries: ListProjectsQuery[];
} {
  const inner = createInMemoryProjectsRepository();
  let workspaceCalls = 0;
  const projectQueries: ListProjectsQuery[] = [];
  return {
    repository: {
      listWorkspaces() {
        workspaceCalls += 1;
        return inner.listWorkspaces();
      },
      listProjects(query) {
        projectQueries.push(query);
        return inner.listProjects(query);
      },
    },
    workspaceCalls: () => workspaceCalls,
    projectQueries,
  };
}

describe('projects service: listProjects', () => {
  it('matches the workspace name case-insensitively', async () => {
    const service = createProjectsService({ repository: createInMemoryProjectsRepository() });
    const projects = await service.listProjects({ workspaceName: 'engineering' });
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.every((project) => project.workspace.name === 'Engineering')).toBe(true);
  });

  it('throws NotFoundError with the exact message for an unknown name', async () => {
    const service = createProjectsService({ repository: createInMemoryProjectsRepository() });
    const failure = service.listProjects({ workspaceName: 'Nope' });
    await expect(failure).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      createProjectsService({ repository: createInMemoryProjectsRepository() }).listProjects({
        workspaceName: 'Nope',
      })
    ).rejects.toThrow(/^Workspace not found: Nope$/);
  });

  it.each([
    ['an empty name', { workspaceName: '' }],
    ['no input at all', undefined],
  ])('lists all projects for %s, without a workspace lookup', async (_label, input) => {
    const spy = spiedRepository();
    const projects = await createProjectsService({ repository: spy.repository }).listProjects(
      input
    );
    expect(projects).toEqual(DEFAULT_IN_MEMORY_SEED.projects);
    expect(spy.workspaceCalls()).toBe(0);
    expect(spy.projectQueries).toEqual([{ workspaceGid: undefined, limit: DEFAULT_LIMIT }]);
  });

  it('looks up the workspace once and passes its gid to listProjects', async () => {
    const spy = spiedRepository();
    await createProjectsService({ repository: spy.repository }).listProjects({
      workspaceName: 'MARKETING',
    });
    expect(spy.workspaceCalls()).toBe(1);
    expect(spy.projectQueries).toEqual([{ workspaceGid: 'ws-2', limit: DEFAULT_LIMIT }]);
  });

  it('passes the default limit (200) when none is given, and an explicit one through', async () => {
    expect(DEFAULT_LIMIT).toBe(200);
    const spy = spiedRepository();
    const service = createProjectsService({ repository: spy.repository });
    await service.listProjects({});
    await service.listProjects({ limit: 3 });
    expect(spy.projectQueries.map((query) => query.limit)).toEqual([200, 3]);
  });
});
