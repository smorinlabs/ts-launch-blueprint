// The request middleware (D-051) through createApp: one JSON line per
// request, request IDs in and out, trace fields, probe levels, and nothing
// sensitive (query strings, inputs) in any line.
import { ApiError, type Core, createCore } from '@ts-launch-blueprint/core';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { requestIdFrom, traceFields, traceFrom } from '../src/request-log.js';
import { captureLogger, type LogLine } from './log-capture.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TRACE = '105445aa7843bc8bf206b12000100000';

/** An app over the demo data with a captured logger. */
function demoApp(
  level: Parameters<typeof captureLogger>[0] = 'debug',
  gcpProjectId?: string
): { app: ReturnType<typeof createApp>; lines: LogLine[] } {
  const { logger, lines } = captureLogger(level);
  return {
    app: createApp({ core: createCore({ source: 'memory' }), logger, gcpProjectId }),
    lines,
  };
}

const rejecting = async (): Promise<never> => {
  throw new ApiError('request to https://upstream.example timed out');
};

const completed = (lines: LogLine[]): LogLine[] =>
  lines.filter((line) => line.message === 'request completed');

describe('request completed lines', () => {
  it('writes one line per request with method, path, status and durationMs', async () => {
    const { app, lines } = demoApp();
    await app.request('/trpc/projects.list');
    const [line] = completed(lines);
    expect(completed(lines)).toHaveLength(1);
    expect(line).toMatchObject({
      severity: 'INFO',
      method: 'GET',
      path: '/trpc/projects.list',
      status: 200,
    });
    expect(typeof line?.['durationMs']).toBe('number');
  });

  it('never logs the query string, an input value, or auth headers', async () => {
    const { app, lines } = demoApp();
    const input = encodeURIComponent(JSON.stringify({ workspaceName: 'secret-ws' }));
    await app.request(`/trpc/projects.list?input=${input}`, {
      headers: { authorization: 'Bearer secret-token', cookie: 'session=secret-cookie' },
    });
    expect(completed(lines)[0]?.['path']).toBe('/trpc/projects.list');
    const text = JSON.stringify(lines);
    for (const leaked of ['secret-ws', 'input=', 'secret-token', 'secret-cookie']) {
      expect(text).not.toContain(leaked);
    }
  });

  it('logs a 404 at INFO, with no error line', async () => {
    const { app, lines } = demoApp();
    await app.request('/nope');
    expect(lines.map((line) => [line.message, line.severity])).toEqual([
      ['request completed', 'INFO'],
    ]);
  });

  it('logs the health probes at DEBUG, and writes nothing for them at the default level', async () => {
    const debug = demoApp('debug');
    await debug.app.request('/healthz');
    await debug.app.request('/readyz');
    expect(completed(debug.lines).map((line) => line.severity)).toEqual(['DEBUG', 'DEBUG']);
    const info = demoApp('info');
    await info.app.request('/healthz');
    expect(info.lines).toEqual([]);
  });

  it('a 5xx: an ERROR request line plus one procedure failed line with the same requestId', async () => {
    const { logger, lines } = captureLogger();
    const core = { projects: { listProjects: rejecting } } as unknown as Core;
    const response = await createApp({ core, logger }).request('/trpc/projects.list');
    expect(response.status).toBe(502);
    const request = completed(lines)[0]!;
    const failure = lines.find((line) => line.message === 'procedure failed')!;
    expect(request.severity).toBe('ERROR');
    expect(failure).toMatchObject({
      severity: 'ERROR',
      requestId: request['requestId'],
      procedure: 'projects.list',
      err: { name: 'ApiError', message: 'request to https://upstream.example timed out' },
    });
    // The client still gets only the generic text (D-049).
    expect(await response.text()).not.toContain('upstream.example');
  });

  it('a thrown handler error: logged from c.res.status after next(), and nothing on console.error', async () => {
    const { app, lines } = demoApp();
    app.get('/boom', () => {
      throw new TypeError('kaboom');
    });
    const response = await app.request('/boom');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
    expect(completed(lines)[0]).toMatchObject({
      severity: 'ERROR',
      status: 500,
      errorName: 'TypeError',
    });
    expect(lines.find((line) => line.message === 'handler failed')).toMatchObject({
      err: { name: 'TypeError', message: 'kaboom' },
    });
  });
});

describe('request IDs', () => {
  it('reuses and echoes a safe incoming x-request-id', async () => {
    const { app, lines } = demoApp();
    const response = await app.request('/healthz', {
      headers: { 'x-request-id': 'abc.DEF_123-x' },
    });
    expect(response.headers.get('x-request-id')).toBe('abc.DEF_123-x');
    expect(completed(lines)[0]?.['requestId']).toBe('abc.DEF_123-x');
  });

  it.each([
    ['too long', 'a'.repeat(129)],
    ['with spaces', 'has spaces'],
    ['with quotes', 'x"y'],
  ])('replaces an unsafe one (%s) with a UUID', async (_label, unsafe) => {
    const { app, lines } = demoApp();
    const response = await app.request('/healthz', { headers: { 'x-request-id': unsafe } });
    const id = response.headers.get('x-request-id');
    expect(id).toMatch(UUID);
    expect(completed(lines)[0]?.['requestId']).toBe(id);
  });

  it('generates one when missing, and the header matches the logged ID', async () => {
    const { app, lines } = demoApp();
    const response = await app.request('/trpc/projects.list');
    const id = response.headers.get('x-request-id');
    expect(id).toMatch(UUID);
    expect(completed(lines)[0]?.['requestId']).toBe(id);
  });

  it('requestIdFrom accepts exactly 1-128 safe characters', () => {
    expect(requestIdFrom('a'.repeat(128))).toBe('a'.repeat(128));
    expect(requestIdFrom('')).toMatch(UUID);
    expect(requestIdFrom(undefined)).toMatch(UUID);
  });
});

describe('trace fields', () => {
  it('x-cloud-trace-context with GCP_PROJECT_ID -> logging.googleapis.com/trace and spanId', async () => {
    const { app, lines } = demoApp('debug', 'my-proj');
    await app.request('/healthz', { headers: { 'x-cloud-trace-context': `${TRACE}/42;o=1` } });
    expect(completed(lines)[0]).toMatchObject({
      'logging.googleapis.com/trace': `projects/my-proj/traces/${TRACE}`,
      'logging.googleapis.com/spanId': '000000000000002a',
    });
  });

  it('without GCP_PROJECT_ID -> a plain traceId field', async () => {
    const { app, lines } = demoApp();
    await app.request('/healthz', { headers: { 'x-cloud-trace-context': TRACE } });
    expect(completed(lines)[0]?.['traceId']).toBe(TRACE);
    expect(completed(lines)[0]).not.toHaveProperty('logging.googleapis.com/trace');
  });

  it('converts the decimal Cloud Run span ID to 16 hex characters', () => {
    expect(traceFrom({ cloudTrace: `${TRACE}/1;o=1` })).toEqual({
      traceId: TRACE,
      spanId: '0000000000000001',
    });
    expect(traceFrom({ cloudTrace: `${TRACE}/18446744073709551615` })?.spanId).toBe(
      'ffffffffffffffff'
    );
  });

  it('keeps the trace but drops a span ID above 64 bits', () => {
    expect(traceFrom({ cloudTrace: `${TRACE}/18446744073709551616;o=1` })).toEqual({
      traceId: TRACE,
      spanId: undefined,
    });
  });

  it('reads W3C traceparent too', () => {
    expect(traceFrom({ traceparent: `00-${TRACE}-00f067aa0ba902b7-01` })).toEqual({
      traceId: TRACE,
      spanId: '00f067aa0ba902b7',
    });
  });

  it.each([
    ['a malformed cloud trace', { cloudTrace: 'not-a-trace' }],
    ['a malformed traceparent', { traceparent: '00-xyz-01' }],
    ['no headers', {}],
  ])('adds nothing for %s', (_label, headers) => {
    expect(traceFields(traceFrom(headers), 'my-proj')).toEqual({});
  });

  it('adds no trace fields to the line for a malformed header', async () => {
    const { app, lines } = demoApp('debug', 'my-proj');
    await app.request('/healthz', { headers: { 'x-cloud-trace-context': 'garbage' } });
    const keys = Object.keys(completed(lines)[0] ?? {});
    expect(keys.some((key) => key.includes('trace'))).toBe(false);
  });
});
