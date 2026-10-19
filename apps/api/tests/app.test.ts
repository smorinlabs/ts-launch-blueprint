// The Hono app in-process via app.request() (no network). NODE_ENV is NOT set
// here on purpose: error bodies must carry no stack trace anyway (isDev: false).
import { createCore, DEFAULT_IN_MEMORY_SEED, type Project } from '@ts-launch-blueprint/core';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

const app = createApp({ core: createCore({ source: 'memory' }) });

/** GET projects.list, with an optional tRPC input (URL-encoded JSON). */
async function listProjects(input?: unknown): Promise<Response> {
  const query = input === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify(input))}`;
  return app.request(`/trpc/projects.list${query}`);
}

interface TrpcError {
  error: { message: string; code: number; data: { code: string; httpStatus: number } };
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

  it('limit 0 -> 400 BAD_REQUEST', async () => {
    const response = await listProjects({ limit: 0 });
    expect(response.status).toBe(400);
    expect(((await response.json()) as TrpcError).error.data.code).toBe('BAD_REQUEST');
  });

  it('an unknown workspace -> 500 INTERNAL_SERVER_ERROR today', async () => {
    // P2-3 maps domain errors to proper codes: this becomes NOT_FOUND (404).
    const response = await listProjects({ workspaceName: 'nope' });
    expect(response.status).toBe(500);
    const body = (await response.json()) as TrpcError;
    expect(body.error.data.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.error.message).toBe('Workspace not found: nope');
  });

  it.each([
    ['the 400', { limit: 0 }],
    ['the 500', { workspaceName: 'nope' }],
  ])('puts no stack trace or file path in %s body', async (_label, input) => {
    const text = JSON.stringify(await (await listProjects(input)).json());
    expect(text).not.toContain('"stack"');
    expect(text).not.toContain('packages/core/src');
  });
});
