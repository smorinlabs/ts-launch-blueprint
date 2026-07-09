// API client tests — port of tests/test_api.py with the transport
// mocked at the injected fetchImpl seam (D-019(5)), the TS equivalent of
// patching requests.Session.request and nothing else.
import { describe, expect, it } from 'vitest';

import {
  ApiError,
  BASE_URL,
  createApiClient,
  DEFAULT_LIMIT,
  type Project,
  type Workspace,
} from '../src/lib/api.js';
import { AuthError, NotFoundError } from '../src/lib/errors.js';

interface RecordedCall {
  url: URL;
  init: RequestInit | undefined;
}

/** fetchImpl fake: replays canned responses in order, recording calls. */
function makeFetch(responses: Array<Response | Error>): {
  fetchImpl: typeof fetch;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const fetchImpl = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls.push({ url: new URL(String(input)), init });
    const next = responses.shift();
    if (next === undefined) {
      throw new Error('fetch fake exhausted');
    }
    if (next instanceof Error) {
      return Promise.reject(next);
    }
    return Promise.resolve(next);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const PROJECT: Project = { id: '1', name: 'Project 1', workspace: { name: 'Workspace 1' } };

describe('client initialization (test_client_initialization parity)', () => {
  it('sends Bearer authorization and Accept headers on every request', async () => {
    const { fetchImpl, calls } = makeFetch([jsonResponse({ data: [] })]);
    const client = createApiClient({ token: 'test_token', fetchImpl });
    await client.getProjects();
    const headers = calls[0]!.init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test_token');
    expect(headers['Accept']).toBe('application/json');
  });

  it('targets the placeholder BASE_URL by default', async () => {
    const { fetchImpl, calls } = makeFetch([jsonResponse({ data: [] })]);
    await createApiClient({ token: 't', fetchImpl }).getProjects();
    expect(calls[0]!.url.toString().startsWith(`${BASE_URL}/projects`)).toBe(true);
  });

  it('honors a baseUrl override (TS_PROJECTS_API_URL seam)', async () => {
    const { fetchImpl, calls } = makeFetch([jsonResponse({ data: [] })]);
    await createApiClient({
      token: 't',
      fetchImpl,
      baseUrl: 'http://127.0.0.1:8080/api/1.0/',
    }).getProjects();
    expect(calls[0]!.url.origin).toBe('http://127.0.0.1:8080');
    expect(calls[0]!.url.pathname).toBe('/api/1.0/projects');
  });
});

describe('successful requests (test_successful_request parity)', () => {
  it('returns the parsed project list', async () => {
    const { fetchImpl } = makeFetch([jsonResponse({ data: [PROJECT] })]);
    const projects = await createApiClient({ token: 't', fetchImpl }).getProjects({ limit: 1 });
    expect(projects).toHaveLength(1);
    expect(projects[0]!.name).toBe('Project 1');
  });

  it('tolerates a missing data key (source .get("data", []) parity)', async () => {
    const { fetchImpl } = makeFetch([jsonResponse({})]);
    const projects = await createApiClient({ token: 't', fetchImpl }).getProjects();
    expect(projects).toEqual([]);
  });
});

describe('failed requests (test_failed_request parity + gap closure)', () => {
  it("surfaces the API's errors[0].message in the ApiError", async () => {
    const { fetchImpl } = makeFetch([jsonResponse({ errors: [{ message: 'Test error' }] }, 500)]);
    await expect(createApiClient({ token: 't', fetchImpl }).getProjects()).rejects.toThrow(
      /API request failed: Test error/
    );
  });

  it('falls back to the HTTP status when the error body is not JSON', async () => {
    const { fetchImpl } = makeFetch([
      new Response('gateway exploded', { status: 502, statusText: 'Bad Gateway' }),
    ]);
    await expect(createApiClient({ token: 't', fetchImpl }).getProjects()).rejects.toThrow(
      /API request failed: HTTP 502/
    );
  });

  it('maps HTTP 401 to AuthError (exit 4, D-016(2))', async () => {
    const { fetchImpl } = makeFetch([
      jsonResponse({ errors: [{ message: 'Not authorized' }] }, 401),
    ]);
    const failure = createApiClient({ token: 'bad', fetchImpl }).getProjects();
    await expect(failure).rejects.toBeInstanceOf(AuthError);
    await expect(
      createApiClient({
        token: 'bad',
        fetchImpl: makeFetch([jsonResponse({ errors: [{ message: 'Not authorized' }] }, 401)])
          .fetchImpl,
      }).getProjects()
    ).rejects.toMatchObject({ exitCode: 4 });
  });

  it('maps network failure to ApiError (exit 1)', async () => {
    const { fetchImpl } = makeFetch([new TypeError('fetch failed')]);
    const failure = createApiClient({ token: 't', fetchImpl }).getProjects();
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    const { fetchImpl: again } = makeFetch([new TypeError('fetch failed')]);
    await expect(
      createApiClient({ token: 't', fetchImpl: again }).getProjects()
    ).rejects.toMatchObject({
      exitCode: 1,
      message: expect.stringContaining('API request failed'),
    });
  });

  it('maps a transport timeout to ApiError mentioning the timeout', async () => {
    const { fetchImpl } = makeFetch([new DOMException('signal timed out', 'TimeoutError')]);
    await expect(
      createApiClient({ token: 't', fetchImpl, timeoutMs: 5 }).getProjects()
    ).rejects.toThrow(/timed out after 5ms/);
  });

  it('maps malformed JSON in a 200 response to ApiError', async () => {
    const { fetchImpl } = makeFetch([new Response('not json{', { status: 200 })]);
    await expect(createApiClient({ token: 't', fetchImpl }).getProjects()).rejects.toThrow(
      /malformed JSON/
    );
  });

  it('maps a non-array data key to ApiError instead of crashing', async () => {
    const { fetchImpl } = makeFetch([jsonResponse({ data: 'oops' })]);
    await expect(createApiClient({ token: 't', fetchImpl }).getProjects()).rejects.toThrow(
      /unexpected \/projects response shape/
    );
  });
});

describe('get_workspaces parity (test_get_workspaces)', () => {
  it('parses the workspace list', async () => {
    const workspaces: Workspace[] = [
      { gid: '1', name: 'Workspace 1' },
      { gid: '2', name: 'Workspace 2' },
    ];
    const { fetchImpl, calls } = makeFetch([jsonResponse({ data: workspaces })]);
    const result = await createApiClient({ token: 't', fetchImpl }).getWorkspaces();
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe('Workspace 1');
    expect(calls[0]!.url.pathname.endsWith('/workspaces')).toBe(true);
  });
});

describe('get_projects parameters (test_get_projects parity)', () => {
  it('forwards limit and opt_fields as request params', async () => {
    const { fetchImpl, calls } = makeFetch([jsonResponse({ data: [PROJECT] })]);
    await createApiClient({ token: 't', fetchImpl }).getProjects({ limit: 1 });
    const params = calls[0]!.url.searchParams;
    expect(params.get('limit')).toBe('1');
    expect(params.get('opt_fields')).toBe('name,workspace.name');
    expect(params.get('workspace')).toBeNull();
  });

  it('defaults limit to 200 (projects.py:217 parity)', async () => {
    const { fetchImpl, calls } = makeFetch([jsonResponse({ data: [] })]);
    await createApiClient({ token: 't', fetchImpl }).getProjects();
    expect(DEFAULT_LIMIT).toBe(200);
    expect(calls[0]!.url.searchParams.get('limit')).toBe('200');
  });
});

describe('workspace filter (test_get_projects_with_workspace parity)', () => {
  it('resolves the workspace name to its gid, case-insensitively', async () => {
    const { fetchImpl, calls } = makeFetch([
      jsonResponse({ data: [{ gid: 'ws1', name: 'Test Workspace' }] }),
      jsonResponse({ data: [] }),
    ]);
    await createApiClient({ token: 't', fetchImpl }).getProjects({
      workspaceName: 'test workspace',
    });
    expect(calls[0]!.url.pathname.endsWith('/workspaces')).toBe(true);
    expect(calls[1]!.url.pathname.endsWith('/projects')).toBe(true);
    expect(calls[1]!.url.searchParams.get('workspace')).toBe('ws1');
  });

  it('unknown workspace -> NotFoundError (test_get_projects_invalid_workspace)', async () => {
    const { fetchImpl } = makeFetch([jsonResponse({ data: [] })]);
    const failure = createApiClient({ token: 't', fetchImpl }).getProjects({
      workspaceName: 'Invalid Workspace',
    });
    await expect(failure).rejects.toBeInstanceOf(NotFoundError);
    const { fetchImpl: again } = makeFetch([jsonResponse({ data: [] })]);
    await expect(
      createApiClient({ token: 't', fetchImpl: again }).getProjects({ workspaceName: 'Nope' })
    ).rejects.toMatchObject({ exitCode: 3, message: 'Workspace not found: Nope' });
  });
});
