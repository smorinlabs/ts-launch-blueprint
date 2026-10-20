// The Hono app in-process via app.request() (no network). NODE_ENV is NOT set
// here on purpose: error bodies must carry no stack trace anyway (isDev: false).
import {
  ApiError,
  AuthError,
  ConflictError,
  type Core,
  createCore,
  DEFAULT_IN_MEMORY_SEED,
  type Project,
} from '@ts-launch-blueprint/core';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import {
  INTERNAL_ERROR_MESSAGE,
  UPSTREAM_AUTH_MESSAGE,
  UPSTREAM_ERROR_MESSAGE,
} from '../src/errors.js';

/** Captured 5xx log lines (the default logger would write to stderr). */
const logged: string[] = [];
const app = createApp({
  core: createCore({ source: 'memory' }),
  logError: (line) => logged.push(line),
});

/** GET projects.list on `target`, with an optional tRPC input (URL-encoded JSON). */
async function listProjects(input?: unknown, target = app): Promise<Response> {
  const query = input === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify(input))}`;
  return target.request(`/trpc/projects.list${query}`);
}

/** An app whose service always rejects with `err`, plus its captured logs. */
function failingApp(err: unknown): { app: ReturnType<typeof createApp>; logs: string[] } {
  const logs: string[] = [];
  const rejecting = async (): Promise<never> => {
    throw err;
  };
  const core = { projects: { listProjects: rejecting } } as unknown as Core;
  return { app: createApp({ core, logError: (line) => logs.push(line) }), logs };
}

interface TrpcError {
  error: {
    message: string;
    code: number;
    data: { code: string; httpStatus: number; issues?: { path: string; message: string }[] };
  };
}

describe('operational routes', () => {
  it('GET /healthz -> 200 {status: ok}', async () => {
    const response = await app.request('/healthz');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('GET /readyz -> 200 {status: ready}', async () => {
    const response = await app.request('/readyz');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ready' });
  });

  it('an unknown path -> 404', async () => {
    expect((await app.request('/nope')).status).toBe(404);
  });
});

describe('GET /trpc/projects.list', () => {
  it('no ?input= -> 200 with the 4 demo projects under result.data.projects', async () => {
    const response = await listProjects();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { result: { data: { projects: Project[] } } };
    expect(body.result.data.projects).toEqual(DEFAULT_IN_MEMORY_SEED.projects);
  });

  it('filters by workspace through the URL-encoded input', async () => {
    const response = await listProjects({ workspaceName: 'engineering' });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { result: { data: { projects: Project[] } } };
    expect(body.result.data.projects.map((project) => project.workspace.name)).toEqual([
      'Engineering',
      'Engineering',
    ]);
  });

  it('limit 0 -> 400 BAD_REQUEST with a readable message and data.issues', async () => {
    const response = await listProjects({ limit: 0 });
    expect(response.status).toBe(400);
    const body = (await response.json()) as TrpcError;
    expect(body.error.data.code).toBe('BAD_REQUEST');
    expect(body.error.message).toMatch(/^limit: /);
    expect(body.error.data.issues?.[0]?.path).toBe('limit');
    // No raw Zod JSON: issues carry only path + message.
    expect(JSON.stringify(body)).not.toContain('"origin"');
  });

  it('an unknown workspace -> 404 NOT_FOUND with the domain message, not logged', async () => {
    logged.length = 0;
    const response = await listProjects({ workspaceName: 'nope' });
    expect(response.status).toBe(404);
    const body = (await response.json()) as TrpcError;
    expect(body.error.data.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Workspace not found: nope');
    expect(logged).toEqual([]);
  });
});

describe('domain errors from the service (fake core)', () => {
  it('ConflictError -> 409 CONFLICT with the domain message', async () => {
    const response = await listProjects(undefined, failingApp(new ConflictError('taken')).app);
    expect(response.status).toBe(409);
    const body = (await response.json()) as TrpcError;
    expect(body.error.data.code).toBe('CONFLICT');
    expect(body.error.message).toBe('taken');
  });

  it.each([
    [
      'AuthError',
      new AuthError('token rejected by https://upstream.example'),
      UPSTREAM_AUTH_MESSAGE,
    ],
    [
      'ApiError',
      new ApiError('request to https://upstream.example timed out'),
      UPSTREAM_ERROR_MESSAGE,
    ],
  ])(
    '%s -> 502 BAD_GATEWAY with a generic message, original logged',
    async (_label, err, message) => {
      const { app: failing, logs } = failingApp(err);
      const response = await listProjects(undefined, failing);
      expect(response.status).toBe(502);
      const body = (await response.json()) as TrpcError;
      expect(body.error.data.code).toBe('BAD_GATEWAY');
      expect(body.error.message).toBe(message);
      expect(JSON.stringify(body)).not.toContain('upstream.example');
      expect(logs).toEqual([`projects.list failed: ${err.name}: ${err.message}`]);
    }
  );

  it('an unexpected Error -> 500 with a generic message; the secret is only logged', async () => {
    const { app: failing, logs } = failingApp(new Error('db password=hunter2'));
    const response = await listProjects(undefined, failing);
    expect(response.status).toBe(500);
    const body = (await response.json()) as TrpcError;
    expect(body.error.data.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.error.message).toBe(INTERNAL_ERROR_MESSAGE);
    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(logs).toEqual(['projects.list failed: Error: db password=hunter2']);
  });
});

/** A service call that always fails with an unexpected error. */
async function rejectWithBoom(): Promise<never> {
  throw new Error('boom');
}

describe('logging and edge cases', () => {
  it('the default logger writes one line to stderr for a 5xx', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const core = { projects: { listProjects: rejectWithBoom } } as unknown as Core;
      const response = await listProjects(undefined, createApp({ core }));
      expect(response.status).toBe(500);
      expect(write).toHaveBeenCalledWith('projects.list failed: Error: boom\n');
    } finally {
      write.mockRestore();
    }
  });

  it('logs a thrown non-Error value as text', async () => {
    const { app: failing, logs } = failingApp('just a string');
    expect((await listProjects(undefined, failing)).status).toBe(500);
    expect(logs).toEqual(['projects.list failed: Error: just a string']);
  });

  it('a wrong input type -> 400 with the issue path reported as "input"', async () => {
    const response = await listProjects('oops');
    expect(response.status).toBe(400);
    const body = (await response.json()) as TrpcError;
    expect(body.error.message).toMatch(/^input: /);
    expect(body.error.data.issues?.[0]?.path).toBe('input');
  });

  it('malformed ?input= -> 400 without data.issues (not a schema error)', async () => {
    const response = await app.request('/trpc/projects.list?input=%7Bnot-json');
    expect(response.status).toBe(400);
    const body = (await response.json()) as TrpcError;
    expect(body.error.data.code).toBe('BAD_REQUEST');
    expect(body.error.data.issues).toBeUndefined();
  });
});

describe('error bodies never carry a stack trace or file path', () => {
  it.each([
    ['the 400', () => listProjects({ limit: 0 })],
    ['the 404', () => listProjects({ workspaceName: 'nope' })],
    ['the 500', () => listProjects(undefined, failingApp(new Error('boom')).app)],
  ])('%s body', async (_label, call) => {
    const text = JSON.stringify(await (await call()).json());
    expect(text).not.toContain('"stack"');
    expect(text).not.toContain('packages/core/src');
  });
});
