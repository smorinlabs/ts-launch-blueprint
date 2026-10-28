// createTracing (D-053): off without an endpoint or exporter, the resource,
// the global registration cycle, and parent-based sampling.
import { propagation, SpanKind } from '@opentelemetry/api';
import { createCore } from '@ts-launch-blueprint/core';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createTracing, displayEndpoint, type Tracing } from '../src/tracing.js';
import { captureLogger } from './log-capture.js';
import { captureTracing } from './trace-capture.js';

const PARENT_TRACE = '0af7651916cd43dd8448eb211c80319c';

let active: Tracing | undefined;
afterEach(async () => {
  await active?.shutdown();
  active = undefined;
});

/** The W3C propagator's fields once registered; none while disabled. */
const registered = (): boolean => propagation.fields().includes('traceparent');

describe('createTracing', () => {
  it('is disabled with no endpoint and no exporter, and touches nothing global', async () => {
    const tracing = createTracing({ serviceName: 'x', sampleRatio: 1 });
    expect(tracing.enabled).toBe(false);
    expect(registered()).toBe(false);
    await expect(tracing.shutdown()).resolves.toBeUndefined();
  });

  it("a disabled instance's middleware only passes the request on", async () => {
    const tracing = createTracing({ serviceName: 'x', sampleRatio: 1 });
    const app = new Hono();
    app.use('*', tracing.httpMiddleware());
    app.get('/x', (c) => c.text('ok'));
    const response = await app.request('/x');
    expect(await response.text()).toBe('ok');
  });

  it('is enabled with an endpoint (spans are batched, nothing sent until a flush)', async () => {
    const tracing = createTracing({
      tracesUrl: 'http://127.0.0.1:9/v1/traces',
      serviceName: 'x',
      sampleRatio: 1,
    });
    active = tracing;
    expect(tracing.enabled).toBe(true);
    expect(registered()).toBe(true);
  });

  it('puts service.name on the resource', () => {
    const { tracing, spans } = captureTracing();
    active = tracing;
    tracing.tracer.startSpan('probe').end();
    expect(spans()[0]?.resource.attributes['service.name']).toBe('ts-launch-blueprint-api');
  });

  it('registers, shuts down (unregistering the globals) and registers again', async () => {
    const first = captureTracing();
    expect(registered()).toBe(true);
    await first.tracing.shutdown();
    expect(registered()).toBe(false);
    const second = captureTracing();
    active = second.tracing;
    second.tracing.tracer.startSpan('again').end();
    expect(second.spans().map((span) => span.name)).toEqual(['again']);
  });
});

/** An app over the demo data with the given tracing. */
const app = (tracing: Tracing): ReturnType<typeof createApp> =>
  createApp({ core: createCore({ source: 'memory' }), logger: captureLogger().logger, tracing });

describe('parent-based sampling', () => {
  it('ratio 0 records nothing for a new trace', async () => {
    const { tracing, spans } = captureTracing(0);
    active = tracing;
    await app(tracing).request('/trpc/projects.list');
    expect(spans()).toEqual([]);
  });

  it('ratio 0 still follows a sampled parent (traceparent flags 01)', async () => {
    const { tracing, spans } = captureTracing(0);
    active = tracing;
    await app(tracing).request('/trpc/projects.list', {
      headers: { traceparent: `00-${PARENT_TRACE}-b7ad6b7169203331-01` },
    });
    const server = spans().find((span) => span.kind === SpanKind.SERVER);
    expect(server?.spanContext().traceId).toBe(PARENT_TRACE);
  });
});

describe('displayEndpoint', () => {
  it('drops credentials, query and fragment', () => {
    expect(displayEndpoint('https://user:secret@collector.example:4318/v1/traces?key=k#x')).toBe(
      'https://collector.example:4318/v1/traces'
    );
  });
});
