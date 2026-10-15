// HTTP repository: response-wrapper handling and request params, with the
// transport mocked at the injected fetchImpl seam (D-019(5)). Transport
// errors, headers and timeouts are covered through createApiClient in
// tests/api.test.ts.
import { describe, expect, it } from 'vitest';

import { createHttpProjectsRepository } from '../src/repositories/http-projects.repository.js';
import { ApiError } from '../src/schemas/errors.js';
import type { Project, Workspace } from '../src/schemas/project.schema.js';

const WORKSPACE: Workspace = { gid: 'ws1', name: 'Acme' };
const PROJECT: Project = { id: '1', name: 'Alpha', workspace: { name: 'Acme' } };

/** A repository whose fetch answers every request with `body` and records URLs. */
function repositoryReturning(body: unknown): {
  repository: ReturnType<typeof createHttpProjectsRepository>;
  urls: URL[];
} {
  const urls: URL[] = [];
  const fetchImpl = ((input: URL) => {
    urls.push(input);
    return Promise.resolve(Response.json(body));
  }) as unknown as typeof fetch;
  return { repository: createHttpProjectsRepository({ token: 't', fetchImpl }), urls };
}

/** Await `promise` and return what it rejected with. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected the promise to reject');
}

describe('HTTP repository: response wrapper', () => {
  it('unwraps valid /workspaces and /projects bodies', async () => {
    expect(await repositoryReturning({ data: [WORKSPACE] }).repository.listWorkspaces()).toEqual([
      WORKSPACE,
    ]);
    expect(
      await repositoryReturning({ data: [PROJECT] }).repository.listProjects({ limit: 10 })
    ).toEqual([PROJECT]);
  });

  it('treats a missing data key as an empty list', async () => {
    expect(await repositoryReturning({}).repository.listWorkspaces()).toEqual([]);
    expect(await repositoryReturning({}).repository.listProjects({ limit: 10 })).toEqual([]);
  });

  it.each([
    ['a body that is not an object', 'oops'],
    ['a null body', null],
    ['a non-array data key', { data: 'oops' }],
  ])('rejects %s with the response-shape ApiError', async (_label, body) => {
    const projectsErr = await rejection(
      repositoryReturning(body).repository.listProjects({ limit: 10 })
    );
    expect(projectsErr).toBeInstanceOf(ApiError);
    expect(projectsErr).toMatchObject({
      message: 'API request failed: unexpected /projects response shape',
    });
    const workspacesErr = await rejection(repositoryReturning(body).repository.listWorkspaces());
    expect(workspacesErr).toBeInstanceOf(ApiError);
    expect(workspacesErr).toMatchObject({
      message: 'API request failed: unexpected /workspaces response shape',
    });
  });

  it('names the endpoint, index and field of an invalid item', async () => {
    const projectsErr = await rejection(
      repositoryReturning({
        data: [PROJECT, PROJECT, { ...PROJECT, name: 42 }],
      }).repository.listProjects({ limit: 10 })
    );
    expect(projectsErr).toBeInstanceOf(ApiError);
    expect((projectsErr as ApiError).message).toMatch(
      /^API request failed: unexpected \/projects item at index 2: name: /
    );
    const workspacesErr = await rejection(
      repositoryReturning({ data: [{ name: 'No gid' }] }).repository.listWorkspaces()
    );
    expect((workspacesErr as ApiError).message).toMatch(
      /^API request failed: unexpected \/workspaces item at index 0: gid: /
    );
  });
});

describe('HTTP repository: request params', () => {
  it('sends limit and opt_fields, and no workspace param without a gid', async () => {
    const { repository, urls } = repositoryReturning({ data: [] });
    await repository.listProjects({ limit: 7 });
    const params = urls[0]!.searchParams;
    expect(urls[0]!.pathname.endsWith('/projects')).toBe(true);
    expect(params.get('limit')).toBe('7');
    expect(params.get('opt_fields')).toBe('name,workspace.name');
    expect(params.has('workspace')).toBe(false);
  });

  it('sends the workspace param only when a gid is given', async () => {
    const { repository, urls } = repositoryReturning({ data: [] });
    await repository.listProjects({ workspaceGid: 'ws1', limit: 7 });
    expect(urls[0]!.searchParams.get('workspace')).toBe('ws1');
  });

  it('lists workspaces from /workspaces', async () => {
    const { repository, urls } = repositoryReturning({ data: [] });
    await repository.listWorkspaces();
    expect(urls[0]!.pathname.endsWith('/workspaces')).toBe(true);
  });

  it('strips every trailing slash from baseUrl, and only those', async () => {
    const urls: URL[] = [];
    const fetchImpl = ((input: URL) => {
      urls.push(input);
      return Promise.resolve(Response.json({ data: [] }));
    }) as unknown as typeof fetch;
    await createHttpProjectsRepository({
      token: 't',
      fetchImpl,
      baseUrl: 'http://127.0.0.1:8080/api//v1///',
    }).listWorkspaces();
    expect(urls[0]!.toString()).toBe('http://127.0.0.1:8080/api//v1/workspaces');
  });
});
