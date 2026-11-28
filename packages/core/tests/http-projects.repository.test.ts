// HTTP repository: response-wrapper handling, getProject, cursor pagination,
// and request params, with the transport mocked at the injected fetchImpl seam
// (D-019(5)). Transport errors, headers and timeouts are covered through
// createApiClient in apps/cli/tests/api.test.ts.
import { describe, expect, it } from 'vitest';

import { createHttpProjectsRepository } from '../src/repositories/http-projects.repository.js';
import { ApiError, AuthError } from '../src/schemas/errors.js';
import type { Project, Workspace } from '../src/schemas/project.schema.js';

const WORKSPACE: Workspace = { gid: 'ws1', name: 'Acme' };
const PROJECT: Project = { id: '1', name: 'Alpha', workspace: { name: 'Acme' } };
const CANARY = 'canary-must-not-appear-in-logs';

/** A repository whose fetch answers every request with `body` and records URLs. */
function repositoryReturning(
  body: unknown,
  status = 200
): {
  repository: ReturnType<typeof createHttpProjectsRepository>;
  urls: URL[];
} {
  const urls: URL[] = [];
  const fetchImpl = ((input: URL) => {
    urls.push(input);
    return Promise.resolve(Response.json(body, { status }));
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
    ).toEqual({ projects: [PROJECT], nextCursor: null });
  });

  it('maps wire gid/id, numeric IDs, and {} or missing workspace to domain Project', async () => {
    const result = await repositoryReturning({
      data: [
        { gid: '1', name: 'Alpha', workspace: { name: 'Acme' } },
        { gid: 2, name: 'Beta', workspace: {} },
        { id: '3', name: 'Gamma' },
      ],
    }).repository.listProjects({ limit: 10 });
    expect(result).toEqual({
      projects: [
        { id: '1', name: 'Alpha', workspace: { name: 'Acme' } },
        { id: '2', name: 'Beta', workspace: null },
        { id: '3', name: 'Gamma', workspace: null },
      ],
      nextCursor: null,
    });
  });

  it.each([
    ['a missing data key ({})', {}],
    ['a renamed data key ({ results: [] })', { results: [] }],
    ['a body that is not an object', 'oops'],
    ['a null body', null],
    ['an array body', []],
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

  it('redacts raw payload values and summarizes multi-item drift with (+N more)', async () => {
    const err = await rejection(
      repositoryReturning({
        data: [{ gid: '1', auth_token: CANARY }, { name: 'B' }],
      }).repository.listProjects({ limit: 10 })
    );
    expect(err).toBeInstanceOf(ApiError);
    const message = (err as ApiError).message;
    expect(message).toContain('data.0.name');
    expect(message).toContain('(+1 more)');
    expect(message).not.toContain(CANARY);
  });
});

describe('HTTP repository: getProject', () => {
  it('fetches /projects/:id with opt_fields and unwraps the single item', async () => {
    const { repository, urls } = repositoryReturning({
      data: { gid: 'p/1', name: 'Alpha', workspace: { name: 'Acme' } },
    });
    const project = await repository.getProject('p/1');
    expect(project).toEqual({ id: 'p/1', name: 'Alpha', workspace: { name: 'Acme' } });
    expect(urls[0]!.pathname).toBe('/api/1.0/projects/p%2F1');
    expect(urls[0]!.searchParams.get('opt_fields')).toBe('name,workspace.name');
  });

  it('returns null on HTTP 404 (absence, not an error)', async () => {
    const { repository } = repositoryReturning({ errors: [{ message: 'Not found' }] }, 404);
    expect(await repository.getProject('missing')).toBeNull();
  });

  it('throws AuthError on HTTP 401/403', async () => {
    await expect(
      repositoryReturning({ errors: [{ message: 'Denied' }] }, 403).repository.getProject('1')
    ).rejects.toBeInstanceOf(AuthError);
  });

  it.each([
    ['non-object body', 'oops'],
    ['missing data', {}],
    ['null data', { data: null }],
    ['array data', { data: [] }],
    ['malformed item', { data: { gid: '1' } }],
  ])('throws ApiError on malformed 200 (%s)', async (_label, body) => {
    await expect(repositoryReturning(body).repository.getProject('1')).rejects.toBeInstanceOf(
      ApiError
    );
  });

  it('handles non-object item in /projects list without crashing', async () => {
    await expect(
      repositoryReturning({ data: ['not-an-object'] }).repository.listProjects({ limit: 5 })
    ).rejects.toThrow(/unexpected \/projects item at index 0/);
  });

  it.each(['.', '..'])(
    'rejects dot-segment id %s with ApiError without calling fetch',
    async (badId) => {
      const { repository, urls } = repositoryReturning({
        data: { gid: badId, name: 'Should not fetch', workspace: null },
      });
      await expect(repository.getProject(badId)).rejects.toBeInstanceOf(ApiError);
      expect(urls).toHaveLength(0);
    }
  );

  it.each([
    ['a/b?c=1', '/api/1.0/projects/a%2Fb%3Fc%3D1'],
    ['proj.1', '/api/1.0/projects/proj.1'],
  ])('continues to accept valid id %s and requests %s', async (id, expectedPathname) => {
    const { repository, urls } = repositoryReturning({
      data: { gid: id, name: 'Valid', workspace: null },
    });
    const project = await repository.getProject(id);
    expect(project).toEqual({ id, name: 'Valid', workspace: null });
    expect(urls).toHaveLength(1);
    expect(urls[0]!.pathname).toBe(expectedPathname);
  });
});

describe('HTTP repository: pagination and request params', () => {
  it('sends limit and opt_fields, and no workspace/offset param when omitted', async () => {
    const { repository, urls } = repositoryReturning({ data: [] });
    await repository.listProjects({ limit: 7 });
    const params = urls[0]!.searchParams;
    expect(urls[0]!.pathname.endsWith('/projects')).toBe(true);
    expect(params.get('limit')).toBe('7');
    expect(params.get('opt_fields')).toBe('name,workspace.name');
    expect(params.has('workspace')).toBe(false);
    expect(params.has('offset')).toBe(false);
  });

  it('forwards cursor as offset and reads next_page.offset into nextCursor', async () => {
    const { repository, urls } = repositoryReturning({
      data: [PROJECT],
      next_page: { offset: 'next-cursor-2' },
    });
    const page = await repository.listProjects({ limit: 1, cursor: 'cursor-1' });
    expect(urls[0]!.searchParams.get('offset')).toBe('cursor-1');
    expect(page).toEqual({ projects: [PROJECT], nextCursor: 'next-cursor-2' });
  });

  it('returns nextCursor: null when next_page is null or omitted', async () => {
    expect(
      (
        await repositoryReturning({ data: [], next_page: null }).repository.listProjects({
          limit: 5,
        })
      ).nextCursor
    ).toBeNull();
  });

  it.each([
    ['non-object next_page', { data: [], next_page: 'oops' }],
    ['non-string next_page.offset', { data: [], next_page: { offset: 123 } }],
  ])('throws ApiError on malformed %s', async (_label, body) => {
    await expect(repositoryReturning(body).repository.listProjects({ limit: 5 })).rejects.toThrow(
      /next_page/
    );
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

  it('cancels the unread 404 response body before returning null from getProject', async () => {
    let cancelled = false;
    const body = new ReadableStream({
      cancel() {
        cancelled = true;
      },
    });
    const fetchImpl = (() =>
      Promise.resolve(new Response(body, { status: 404 }))) as unknown as typeof fetch;
    const result = await createHttpProjectsRepository({
      token: 't',
      fetchImpl,
    }).getProject('missing');
    expect(result).toBeNull();
    expect(cancelled).toBe(true);
  });
});
