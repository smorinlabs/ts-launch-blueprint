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
} from 'ts-launch-blueprint-core';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import {
  INTERNAL_ERROR_MESSAGE,
  UPSTREAM_AUTH_MESSAGE,
  UPSTREAM_ERROR_MESSAGE,
} from '../src/errors.js';
import { createMetrics } from '../src/metrics.js';
import { PROBLEM_CONTENT_TYPE } from '../src/problems.js';
import { VERSION } from '../src/version.js';
import { captureLogger, type LogLine } from './log-capture.js';

/** The `procedure failed` lines, as `<procedure> failed: <name>: <message>`. */
function procedureFailures(lines: LogLine[]): string[] {
  return lines
    .filter((line) => line.message === 'procedure failed')
    .map((line) => {
      const err = line['err'] as { name: string; message: string };
      return `${String(line['procedure'])} failed: ${err.name}: ${err.message}`;
    });
}

const captured = captureLogger();
const app = createApp({ core: createCore({ source: 'memory' }), logger: captured.logger });

/** GET projects.list on `target`, with an optional tRPC input (URL-encoded JSON). */
async function listProjects(input?: unknown, target = app): Promise<Response> {
  const query = input === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify(input))}`;
  return target.request(`/trpc/projects.list${query}`);
}

/** GET projects.get on `target`, with a tRPC input (URL-encoded JSON). */
async function getProject(input: unknown, target = app): Promise<Response> {
  return target.request(`/trpc/projects.get?input=${encodeURIComponent(JSON.stringify(input))}`);
}

/** An app whose service always rejects with `err`, plus its captured logs. */
function failingApp(err: unknown): {
  app: ReturnType<typeof createApp>;
  lines: LogLine[];
} {
  const { logger, lines } = captureLogger();
  const rejecting = async (): Promise<never> => {
    throw err;
  };
  const core = { projects: { listProjects: rejecting, getProject: rejecting } } as unknown as Core;
  return { app: createApp({ core, logger }), lines };
}

interface TrpcError {
  error: {
    message: string;
    code: number;
    data: { code: string; httpStatus: number; issues?: { path: string; message: string }[] };
  };
}

describe('operational routes', () => {
  it('GET /healthz -> 200 {status: ok, version, runtime}', async () => {
    const response = await app.request('/healthz');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      version: VERSION,
      runtime: process.version,
    });
  });

  it('GET /readyz -> 200 {status: ready, checks}', async () => {
    const response = await app.request('/readyz');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ready',
      checks: [
        { name: 'runtime', status: 'ok', detail: process.version },
        { name: 'core', status: 'ok', detail: 'initialized' },
      ],
    });
  });

  it('GET /readyz -> 503 application/problem+json when checkReadiness reports an error', async () => {
    const unreadyApp = createApp({
      core: createCore({ source: 'memory' }),
      logger: captureLogger().logger,
      checkReadiness: () => [{ name: 'database', status: 'error', detail: 'connection refused' }],
    });
    const response = await unreadyApp.request('/readyz');
    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toContain(PROBLEM_CONTENT_TYPE);
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(await response.json()).toEqual({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      detail: 'Readiness checks failed.',
      instance: '/readyz',
      checks: [{ name: 'database', status: 'error', detail: 'connection refused' }],
    });
  });

  it('GET /readyz -> 503 application/problem+json when checkReadiness throws without leaking secrets', async () => {
    const { logger, lines } = captureLogger();
    const throwingApp = createApp({
      core: createCore({ source: 'memory' }),
      logger,
      checkReadiness: () => {
        throw new Error('postgres://user:secret@db.internal:5432 failed');
      },
    });
    const response = await throwingApp.request('/readyz');
    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toContain(PROBLEM_CONTENT_TYPE);
    const body = await response.json();
    expect(body).toEqual({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      detail: 'Readiness checks failed.',
      instance: '/readyz',
      checks: [{ name: 'readiness', status: 'error', detail: 'Readiness check failed' }],
    });
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(lines.find((l) => l.message === 'readiness check failed')).toBeDefined();
  });

  it('an unknown path -> 404 application/problem+json', async () => {
    const response = await app.request('/nope');
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain(PROBLEM_CONTENT_TYPE);
    expect(await response.json()).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Route not found: /nope',
      instance: '/nope',
    });
  });
});

describe('security headers, CORS, and rate limiting', () => {
  const EXPECTED_HEADERS = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'strict-transport-security': 'max-age=63072000; includeSubDomains',
  };

  it('sets conservative security headers on 200, 404, and 500 responses', async () => {
    const testApp = createApp({
      core: createCore({ source: 'memory' }),
      logger: captureLogger().logger,
    });
    testApp.get('/boom', () => {
      throw new Error('explode');
    });
    for (const path of ['/healthz', '/nope', '/boom']) {
      const response = await testApp.request(path);
      for (const [header, value] of Object.entries(EXPECTED_HEADERS)) {
        expect(response.headers.get(header)).toBe(value);
      }
      expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    }
  });

  it('disables CORS by default', async () => {
    const response = await app.request('/healthz', {
      headers: { origin: 'https://evil.example' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('mounts opt-in CORS with allowed origins, preflight OPTIONS, and security headers', async () => {
    const corsApp = createApp({
      core: createCore({ source: 'memory' }),
      logger: captureLogger().logger,
      corsOrigins: ['https://app.example.com'],
    });

    const allowed = await corsApp.request('/healthz', {
      headers: { origin: 'https://app.example.com' },
    });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(allowed.headers.get('cross-origin-resource-policy')).toBe('cross-origin');

    const disallowed = await corsApp.request('/healthz', {
      headers: { origin: 'https://evil.example' },
    });
    expect(disallowed.status).toBe(200);
    expect(disallowed.headers.get('access-control-allow-origin')).toBeNull();

    const preflight = await corsApp.request('/trpc/projects.list', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://app.example.com',
        'access-control-request-method': 'GET',
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    for (const [header, value] of Object.entries(EXPECTED_HEADERS)) {
      expect(preflight.headers.get(header)).toBe(value);
    }
    expect(preflight.headers.get('x-request-id')).toBeTruthy();
  });

  it('supports wildcard CORS_ORIGINS=["*"]', async () => {
    const wildcardApp = createApp({
      core: createCore({ source: 'memory' }),
      logger: captureLogger().logger,
      corsOrigins: ['*'],
    });
    const response = await wildcardApp.request('/healthz', {
      headers: { origin: 'https://any.example' },
    });
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('disables rate limiting by default (30 requests succeed)', async () => {
    for (let i = 0; i < 30; i += 1) {
      const response = await app.request('/healthz');
      expect(response.status).toBe(200);
      expect(response.headers.get('x-ratelimit-limit')).toBeNull();
    }
  });

  it('enforces opt-in rate limit, wires trustProxy, and preserves security headers + x-request-id on 429', async () => {
    const limitedApp = createApp({
      core: createCore({ source: 'memory' }),
      logger: captureLogger().logger,
      rateLimit: { limit: 2, windowMs: 60_000, unit: 'minute' },
      trustProxy: ['10.0.0.0/8'],
    });

    const proxyEnv = { incoming: { socket: { remoteAddress: '10.0.0.1' } } };
    const r1 = await limitedApp.request(
      '/healthz',
      { headers: { 'x-real-ip': '203.0.113.5' } },
      proxyEnv
    );
    const r2 = await limitedApp.request(
      '/healthz',
      { headers: { 'x-real-ip': '203.0.113.5' } },
      proxyEnv
    );
    const r3 = await limitedApp.request(
      '/healthz',
      { headers: { 'x-real-ip': '203.0.113.5' } },
      proxyEnv
    );
    // Different client behind the trusted proxy gets its own bucket.
    const other = await limitedApp.request(
      '/healthz',
      { headers: { 'x-real-ip': '203.0.113.6' } },
      proxyEnv
    );

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
    expect(other.status).toBe(200);
    expect(r3.headers.get('content-type')).toContain(PROBLEM_CONTENT_TYPE);
    expect(r3.headers.get('retry-after')).toBeTruthy();
    expect(r3.headers.get('x-ratelimit-limit')).toBe('2');
    expect(r3.headers.get('x-ratelimit-remaining')).toBe('0');
    expect(r3.headers.get('x-ratelimit-reset')).toBeTruthy();
    expect(r3.headers.get('x-request-id')).toBeTruthy();
    for (const [header, value] of Object.entries(EXPECTED_HEADERS)) {
      expect(r3.headers.get(header)).toBe(value);
    }
  });

  it('applies CORS and rate-limit middleware to GET /metrics while counting rejected requests', async () => {
    const metrics = createMetrics({ collectDefaults: false });
    const metricsApp = createApp({
      core: createCore({ source: 'memory' }),
      logger: captureLogger().logger,
      metrics,
      corsOrigins: ['https://app.example.com'],
      rateLimit: { limit: 1, windowMs: 60_000, unit: 'minute' },
    });

    const first = await metricsApp.request('/metrics', {
      headers: { origin: 'https://app.example.com', 'x-real-ip': '203.0.113.9' },
    });
    expect(first.status).toBe(200);
    expect(first.headers.get('access-control-allow-origin')).toBe('https://app.example.com');

    const limited = await metricsApp.request('/metrics', {
      headers: { origin: 'https://app.example.com', 'x-real-ip': '203.0.113.9' },
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
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
    expect(body.result.data.projects.map((project) => project.workspace?.name)).toEqual([
      'Engineering',
      'Engineering',
    ]);
  });

  it('limit 101 -> 400 BAD_REQUEST (MAX_API_LIMIT = 100, Q7.A)', async () => {
    const response = await listProjects({ limit: 101 });
    expect(response.status).toBe(400);
    const body = (await response.json()) as TrpcError;
    expect(body.error.data.code).toBe('BAD_REQUEST');
    expect(body.error.data.issues?.[0]?.path).toBe('limit');
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
    captured.lines.length = 0;
    const response = await listProjects({ workspaceName: 'nope' });
    expect(response.status).toBe(404);
    const body = (await response.json()) as TrpcError;
    expect(body.error.data.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Workspace not found: nope');
    expect(procedureFailures(captured.lines)).toEqual([]);
  });
});

describe('GET /trpc/projects.get', () => {
  it('returns 200 with { project } for a known id', async () => {
    const response = await getProject({ id: 'p-1' });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { result: { data: { project: Project } } };
    expect(body.result.data.project).toEqual(DEFAULT_IN_MEMORY_SEED.projects[0]);
  });

  it('returns 404 NOT_FOUND for a missing id', async () => {
    const response = await getProject({ id: 'missing' });
    expect(response.status).toBe(404);
    const body = (await response.json()) as TrpcError;
    expect(body.error.data.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Project not found: missing');
  });

  it('returns 400 BAD_REQUEST for an empty id', async () => {
    const response = await getProject({ id: '' });
    expect(response.status).toBe(400);
    const body = (await response.json()) as TrpcError;
    expect(body.error.data.code).toBe('BAD_REQUEST');
    expect(body.error.data.issues?.[0]?.path).toBe('id');
  });

  it('returns 502 BAD_GATEWAY when upstream fails', async () => {
    const response = await getProject({ id: 'p-1' }, failingApp(new ApiError('boom')).app);
    expect(response.status).toBe(502);
    const body = (await response.json()) as TrpcError;
    expect(body.error.data.code).toBe('BAD_GATEWAY');
    expect(body.error.message).toBe(UPSTREAM_ERROR_MESSAGE);
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
      const { app: failing, lines } = failingApp(err);
      const response = await listProjects(undefined, failing);
      expect(response.status).toBe(502);
      const body = (await response.json()) as TrpcError;
      expect(body.error.data.code).toBe('BAD_GATEWAY');
      expect(body.error.message).toBe(message);
      expect(JSON.stringify(body)).not.toContain('upstream.example');
      expect(procedureFailures(lines)).toEqual([
        `projects.list failed: ${err.name}: ${err.message}`,
      ]);
    }
  );

  it('an unexpected Error -> 500 with a generic message; the secret is only logged', async () => {
    const { app: failing, lines } = failingApp(new Error('db password=hunter2'));
    const response = await listProjects(undefined, failing);
    expect(response.status).toBe(500);
    const body = (await response.json()) as TrpcError;
    expect(body.error.data.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.error.message).toBe(INTERNAL_ERROR_MESSAGE);
    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(procedureFailures(lines)).toEqual(['projects.list failed: Error: db password=hunter2']);
  });
});

/** A service call that always fails with an unexpected error. */
async function rejectWithBoom(): Promise<never> {
  throw new Error('boom');
}

describe('logging and edge cases', () => {
  it('a 5xx writes nothing to stderr or console.error: it is all JSON log lines', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { logger, lines } = captureLogger();
      const core = { projects: { listProjects: rejectWithBoom } } as unknown as Core;
      const response = await listProjects(undefined, createApp({ core, logger }));
      expect(response.status).toBe(500);
      expect(procedureFailures(lines)).toEqual(['projects.list failed: Error: boom']);
      expect(write).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      write.mockRestore();
      consoleError.mockRestore();
    }
  });

  it('logs a thrown non-Error value as text', async () => {
    const { app: failing, lines } = failingApp('just a string');
    expect((await listProjects(undefined, failing)).status).toBe(500);
    expect(procedureFailures(lines)).toEqual(['projects.list failed: Error: just a string']);
  });

  it('a wrong input type -> 400 with the issue path reported as "input"', async () => {
    const response = await listProjects('oops');
    expect(response.status).toBe(400);
    const body = (await response.json()) as TrpcError;
    expect(body.error.message).toMatch(/^input: /);
    expect(body.error.data.issues?.[0]?.path).toBe('input');
  });

  it('malformed ?input= -> 400 without data.issues (not a schema error)', async () => {
    // cspell:ignore Bnot
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
