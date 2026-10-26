// The metrics module (D-052): the label functions that keep cardinality
// bounded, and per-app registries.
import { createCore } from '@ts-launch-blueprint/core';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createMetrics, KNOWN_PROCEDURES, procedureLabel, routeLabel } from '../src/metrics.js';
import { captureLogger } from './log-capture.js';

// What matchedRoutes(c) gives for each kind of request (spike-verified):
// the two `/*` middlewares (request log, metrics), then the matched route.
const MIDDLEWARES = ['/*', '/*'];

describe('routeLabel', () => {
  it.each([
    ['/healthz', '/healthz'],
    ['/readyz', '/readyz'],
  ])('keeps a probe path (%s)', (path, label) => {
    expect(routeLabel([...MIDDLEWARES, path], path)).toBe(label);
  });

  it.each([
    ['a known procedure', '/trpc/projects.list', '/trpc/projects.list'],
    ['an unknown procedure', '/trpc/doesNotExist', '/trpc/unknown'],
    ['no procedure (/trpc)', '/trpc', '/trpc/unknown'],
    ['no procedure (/trpc/)', '/trpc/', '/trpc/unknown'],
    ['a batch of one known procedure', '/trpc/projects.list', '/trpc/projects.list'],
    ['a batch of known procedures', '/trpc/projects.list,projects.list', '/trpc/batch'],
    ['a batch with an unknown procedure', '/trpc/projects.list,doesNotExist', '/trpc/unknown'],
    ['a batch with an empty name', '/trpc/projects.list,', '/trpc/unknown'],
  ])('tRPC: %s', (_label, path, label) => {
    expect(routeLabel([...MIDDLEWARES, '/trpc/*'], path)).toBe(label);
  });

  it.each([['/nope/123'], ['/healthz/']])('only middlewares matched (%s) -> unmatched', (path) => {
    expect(routeLabel(MIDDLEWARES, path)).toBe('unmatched');
  });
});

describe('procedureLabel', () => {
  it('keeps a known procedure name', () => {
    expect(KNOWN_PROCEDURES).toEqual(new Set(['projects.list']));
    expect(procedureLabel('projects.list')).toBe('projects.list');
  });

  it.each([['doesNotExist'], [''], [undefined]])('maps %j to unknown', (name) => {
    expect(procedureLabel(name)).toBe('unknown');
  });
});

describe('createMetrics', () => {
  it('gives each app its own registry', async () => {
    const { logger } = captureLogger();
    const core = createCore({ source: 'memory' });
    const first = createMetrics({ collectDefaults: false });
    const second = createMetrics({ collectDefaults: false });
    await createApp({ core, logger, metrics: first }).request('/healthz');
    expect(await first.registry.metrics()).toContain(
      'http_requests_total{method="GET",route="/healthz",status="200"} 1'
    );
    expect(await second.registry.metrics()).not.toContain('route="/healthz"');
  });

  it('adds the default Node metrics only when asked', async () => {
    const withDefaults = await createMetrics({ collectDefaults: true }).registry.metrics();
    expect(withDefaults).toContain('process_cpu_seconds_total');
    expect(withDefaults).toMatch(/^nodejs_/m);
    const without = await createMetrics({ collectDefaults: false }).registry.metrics();
    expect(without).not.toContain('process_cpu_seconds_total');
  });
});
