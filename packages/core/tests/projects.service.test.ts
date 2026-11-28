// Projects service: business rules tested over the in-memory repository
// (no fetch mocks). A small spy records what the service asks the
// repository for.
import { describe, expect, it } from 'vitest';

import {
  createInMemoryProjectsRepository,
  DEFAULT_IN_MEMORY_SEED,
} from '../src/repositories/in-memory-projects.repository.js';
import type {
  ListProjectsQuery,
  ProjectsRepository,
} from '../src/repositories/projects.repository.js';
import { NotFoundError } from '../src/schemas/errors.js';
import { createProjectsService, DEFAULT_LIMIT } from '../src/services/projects.service.js';

/** The in-memory repository, wrapped to count and record calls. */
function spiedRepository(): {
  repository: ProjectsRepository;
  workspaceCalls: () => number;
  projectQueries: ListProjectsQuery[];
  getProjectIds: string[];
} {
  const inner = createInMemoryProjectsRepository();
  let workspaceCalls = 0;
  const projectQueries: ListProjectsQuery[] = [];
  const getProjectIds: string[] = [];
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
      getProject(id) {
        getProjectIds.push(id);
        return inner.getProject(id);
      },
    },
    workspaceCalls: () => workspaceCalls,
    projectQueries,
    getProjectIds,
  };
}

describe('projects service: listProjects', () => {
  it('matches the workspace name case-insensitively', async () => {
    const service = createProjectsService({ repository: createInMemoryProjectsRepository() });
    const { projects } = await service.listProjects({ workspaceName: 'engineering' });
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.every((project) => project.workspace?.name === 'Engineering')).toBe(true);
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
    const output = await createProjectsService({ repository: spy.repository }).listProjects(input);
    expect(output).toEqual({
      projects: DEFAULT_IN_MEMORY_SEED.projects,
      nextCursor: null,
    });
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

  it('passes the default limit (200) when none is given, and leaves core uncapped (Q7.A)', async () => {
    expect(DEFAULT_LIMIT).toBe(200);
    const spy = spiedRepository();
    const service = createProjectsService({ repository: spy.repository });
    await service.listProjects({});
    await service.listProjects({ limit: 3 });
    await service.listProjects({ limit: 500 });
    expect(spy.projectQueries.map((query) => query.limit)).toEqual([200, 3, 500]);
  });

  it('forwards cursor to the repository and returns nextCursor across pages', async () => {
    const spy = spiedRepository();
    const service = createProjectsService({ repository: spy.repository });
    const page1 = await service.listProjects({ limit: 2 });
    expect(page1.projects).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await service.listProjects({ limit: 2, cursor: page1.nextCursor! });
    expect(page2.projects).toHaveLength(2);
    expect(page2.nextCursor).toBeNull();
    expect(spy.projectQueries[1]).toEqual({
      workspaceGid: undefined,
      limit: 2,
      cursor: page1.nextCursor!,
    });
  });
});

describe('projects service: getProject', () => {
  it('returns the matching project when present', async () => {
    const spy = spiedRepository();
    const service = createProjectsService({ repository: spy.repository });
    const project = await service.getProject('p-1');
    expect(project).toEqual(DEFAULT_IN_MEMORY_SEED.projects[0]);
    expect(spy.getProjectIds).toEqual(['p-1']);
  });

  it('throws NotFoundError when repository returns null', async () => {
    const service = createProjectsService({ repository: createInMemoryProjectsRepository() });
    await expect(service.getProject('missing-id')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getProject('missing-id')).rejects.toThrow(
      /^Project not found: missing-id$/
    );
  });
});
