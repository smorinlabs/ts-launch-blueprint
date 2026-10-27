// Spans through createApp (D-053): the server span per request, the tRPC
// child spans, traceparent continuation, status rules, untraced paths, log
// correlation, and nothing sensitive (query, input, 5xx message) on a span.
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace';
import { ApiError, type Core, createCore } from '@ts-launch-blueprint/core';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createMetrics } from '../src/metrics.js';
import type { Tracing } from '../src/tracing.js';
import { captureLogger, type LogLine } from './log-capture.js';
import { captureTracing } from './trace-capture.js';

const PARENT_TRACE = '0af7651916cd43dd8448eb211c80319c';
const PARENT_SPAN = 'b7ad6b7169203331';
const UPSTREAM_MESSAGE = 'request to https://upstream.example timed out';

const rejecting = async (): Promise<never> => {
  throw new ApiError(UPSTREAM_MESSAGE);
};

let active: Tracing | undefined;
afterEach(async () => {
  await active?.shutdown();
  active = undefined;
});

/** An app with tracing (in memory), metrics and a captured logger. */
function tracedApp(core: Core = createCore({ source: 'memory' })): {
  app: ReturnType<typeof createApp>;
  spans: () => ReadableSpan[];
  lines: LogLine[];
} {
  const { tracing, spans } = captureTracing();
  active = tracing;
  const { logger, lines } = captureLogger();
  const metrics = createMetrics({ collectDefaults: false });
  return { app: createApp({ core, logger, metrics, tracing }), spans, lines };
}

const serverSpans = (spans: ReadableSpan[]): ReadableSpan[] =>
  spans.filter((span) => span.kind === SpanKind.SERVER);
const childSpans = (spans: ReadableSpan[]): ReadableSpan[] =>
  spans.filter((span) => span.kind === SpanKind.INTERNAL);
const encoded = (value: unknown): string => encodeURIComponent(JSON.stringify(value));

describe('server span', () => {
  it('projects.list: one server span with the 4 attributes, and no query anywhere', async () => {
    const { app, spans } = tracedApp();
    await app.request(`/trpc/projects.list?input=${encoded({ workspaceName: 'secret-ws' })}`);
    const [server] = serverSpans(spans());
    expect(serverSpans(spans())).toHaveLength(1);
    expect(server?.name).toBe('GET /trpc/projects.list');
    expect(server?.attributes).toEqual({
      'http.request.method': 'GET',
      'http.route': '/trpc/projects.list',
      'url.path': '/trpc/projects.list',
      'http.response.status_code': 404,
    });
    const text = JSON.stringify(spans().map((span) => [span.name, span.attributes, span.status]));
    expect(text).not.toContain('secret-ws');
    expect(text).not.toContain('input=');
  });

  it('a child trpc span per procedure, parented by the server span', async () => {
    const { app, spans } = tracedApp();
    await app.request('/trpc/projects.list');
    const [server] = serverSpans(spans());
    const [child] = childSpans(spans());
    expect(child?.name).toBe('trpc projects.list');
    expect(child?.attributes).toEqual({ 'rpc.system': 'trpc', 'rpc.method': 'projects.list' });
    expect(child?.parentSpanContext?.spanId).toBe(server?.spanContext().spanId);
    expect(child?.spanContext().traceId).toBe(server?.spanContext().traceId);
  });

  it('continues an incoming traceparent: same trace ID, the given span as parent', async () => {
    const { app, spans } = tracedApp();
    await app.request('/trpc/projects.list', {
      headers: { traceparent: `00-${PARENT_TRACE}-${PARENT_SPAN}-01` },
    });
    const [server] = serverSpans(spans());
    expect(server?.spanContext().traceId).toBe(PARENT_TRACE);
    expect(server?.parentSpanContext?.spanId).toBe(PARENT_SPAN);
  });

  it('a 404 (unknown workspace) stays UNSET, with no error.type', async () => {
    const { app, spans } = tracedApp();
    await app.request(`/trpc/projects.list?input=${encoded({ workspaceName: 'nope' })}`);
    for (const span of spans()) {
      expect(span.status.code).toBe(SpanStatusCode.UNSET);
      expect(span.attributes).not.toHaveProperty('error.type');
    }
    expect(serverSpans(spans())[0]?.attributes['http.response.status_code']).toBe(404);
  });

  it('a 502 (ApiError): both spans ERROR with error.type, and no original message', async () => {
    const { app, spans } = tracedApp({ projects: { listProjects: rejecting } } as unknown as Core);
    const response = await app.request('/trpc/projects.list');
    expect(response.status).toBe(502);
    const [server] = serverSpans(spans());
    const [child] = childSpans(spans());
    expect(server?.status.code).toBe(SpanStatusCode.ERROR);
    expect(server?.attributes['error.type']).toBe('502');
    expect(child?.status.code).toBe(SpanStatusCode.ERROR);
    expect(child?.attributes['error.type']).toBe('BAD_GATEWAY');
    const text = JSON.stringify(
      spans().map((span) => [span.name, span.attributes, span.status, span.events])
    );
    expect(text).not.toContain('upstream.example');
  });

  it('a thrown route handler: ERROR with the error name as error.type', async () => {
    const { app, spans } = tracedApp();
    app.get('/boom', () => {
      throw new TypeError('kaboom');
    });
    await app.request('/boom');
    const [server] = serverSpans(spans());
    expect(server?.name).toBe('GET /boom');
    expect(server?.attributes['error.type']).toBe('TypeError');
    expect(JSON.stringify(server?.attributes)).not.toContain('kaboom');
  });

  it('names by route pattern: /nope/123 -> GET unmatched; a batch -> GET /trpc/batch', async () => {
    const { app, spans } = tracedApp();
    await app.request('/nope/123');
    await app.request(`/trpc/projects.list,projects.list?batch=1&input=${encoded({})}`);
    expect(serverSpans(spans()).map((span) => span.name)).toEqual([
      'GET unmatched',
      'GET /trpc/batch',
    ]);
    expect(childSpans(spans()).map((span) => span.name)).toEqual([
      'trpc projects.list',
      'trpc projects.list',
    ]);
  });

  it('creates no spans for /healthz, /readyz and /metrics', async () => {
    const { app, spans } = tracedApp();
    for (const path of ['/healthz', '/readyz', '/metrics']) {
      expect((await app.request(path)).status).toBe(200);
    }
    expect(spans()).toEqual([]);
  });
});

describe('log correlation', () => {
  it('the request line carries the server span IDs and trace_sampled', async () => {
    const { app, spans, lines } = tracedApp();
    await app.request('/trpc/projects.list');
    const [server] = serverSpans(spans());
    const line = lines.find((entry) => entry.message === 'request completed');
    expect(line).toMatchObject({
      traceId: server?.spanContext().traceId,
      'logging.googleapis.com/spanId': server?.spanContext().spanId,
      'logging.googleapis.com/trace_sampled': true,
    });
  });

  it('a 5xx procedure failed line carries the same span IDs', async () => {
    const { app, spans, lines } = tracedApp({
      projects: { listProjects: rejecting },
    } as unknown as Core);
    await app.request('/trpc/projects.list');
    const [server] = serverSpans(spans());
    const failure = lines.find((entry) => entry.message === 'procedure failed');
    expect(failure?.['traceId']).toBe(server?.spanContext().traceId);
  });
});
