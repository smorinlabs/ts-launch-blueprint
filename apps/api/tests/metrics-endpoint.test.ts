// GET /metrics and what requests add to it, through createApp with a test
// metrics instance (no default Node metrics, so values are exact).
import { ApiError, type Core, createCore } from '@ts-launch-blueprint/core';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createMetrics } from '../src/metrics.js';
import { captureLogger, type LogLine } from './log-capture.js';

const rejecting = async (): Promise<never> => {
  throw new ApiError('request to https://upstream.example timed out');
};

/** An app with its own metrics and a captured logger. */
function metricsApp(core: Core = createCore({ source: 'memory' })): {
  app: ReturnType<typeof createApp>;
  lines: LogLine[];
  scrape: () => Promise<string>;
} {
  const { logger, lines } = captureLogger();
  const metrics = createMetrics({ collectDefaults: false });
  const app = createApp({ core, logger, metrics });
  return { app, lines, scrape: async () => (await app.request('/metrics')).text() };
}

const encoded = (value: unknown): string => encodeURIComponent(JSON.stringify(value));

describe('GET /metrics', () => {
  it('serves the Prometheus text format', async () => {
    const { app } = metricsApp();
    const response = await app.request('/metrics');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^text\/plain/);
    expect(await response.text()).toContain('# TYPE http_requests_total counter');
  });

  it('counts one projects.list call, with one duration observation', async () => {
    const { app, scrape } = metricsApp();
    await app.request('/trpc/projects.list');
    const text = await scrape();
    expect(text).toContain(
      'http_requests_total{method="GET",route="/trpc/projects.list",status="200"} 1'
    );
    expect(text).toContain(
      'http_request_duration_seconds_count{method="GET",route="/trpc/projects.list",status="200"} 1'
    );
  });

  it('counts an unknown workspace as a 404 and a NOT_FOUND tRPC error', async () => {
    const { app, scrape } = metricsApp();
    await app.request(`/trpc/projects.list?input=${encoded({ workspaceName: 'nope' })}`);
    const text = await scrape();
    expect(text).toContain(
      'http_requests_total{method="GET",route="/trpc/projects.list",status="404"} 1'
    );
    expect(text).toContain('trpc_errors_total{procedure="projects.list",code="NOT_FOUND"} 1');
  });

  it('cardinality guard: two different unmatched paths share one series', async () => {
    const { app, scrape } = metricsApp();
    await app.request('/nope/123');
    await app.request('/nope/456');
    const text = await scrape();
    expect(text).toContain('http_requests_total{method="GET",route="unmatched",status="404"} 2');
    expect(text).not.toContain('/nope');
  });

  it('unknown or empty procedure names count as /trpc/unknown, never by name', async () => {
    const { app, scrape } = metricsApp();
    await app.request('/trpc/doesNotExist');
    await app.request('/trpc');
    await app.request('/trpc/');
    const text = await scrape();
    expect(text).toContain(
      'http_requests_total{method="GET",route="/trpc/unknown",status="404"} 3'
    );
    expect(text).toContain('trpc_errors_total{procedure="unknown",code="NOT_FOUND"} 3');
    expect(text).not.toContain('doesNotExist');
  });

  it('a POST to the query (415, no procedure path) counts as procedure="unknown"', async () => {
    const { app, scrape } = metricsApp();
    const response = await app.request('/trpc/projects.list', { method: 'POST' });
    expect(response.status).toBe(415);
    const text = await scrape();
    expect(text).toContain(
      'trpc_errors_total{procedure="unknown",code="UNSUPPORTED_MEDIA_TYPE"} 1'
    );
    expect(text).not.toContain('procedure="undefined"');
  });

  it('batching: one known call shares the plain series; several are /trpc/batch', async () => {
    const { app, scrape } = metricsApp();
    await app.request('/trpc/projects.list');
    await app.request(`/trpc/projects.list?batch=1&input=${encoded({})}`);
    const batch = await app.request(
      `/trpc/projects.list,projects.list?batch=1&input=${encoded({})}`
    );
    expect(batch.status).toBe(200);
    const text = await scrape();
    expect(text).toContain(
      'http_requests_total{method="GET",route="/trpc/projects.list",status="200"} 2'
    );
    expect(text).toContain('http_requests_total{method="GET",route="/trpc/batch",status="200"} 1');
  });

  it('counts a 5xx (ApiError) as status 502 and BAD_GATEWAY', async () => {
    const { app, scrape } = metricsApp({
      projects: { listProjects: rejecting },
    } as unknown as Core);
    await app.request('/trpc/projects.list');
    const text = await scrape();
    expect(text).toContain(
      'http_requests_total{method="GET",route="/trpc/projects.list",status="502"} 1'
    );
    expect(text).toContain('trpc_errors_total{procedure="projects.list",code="BAD_GATEWAY"} 1');
  });

  it('does not count its own scrapes, and logs them at DEBUG only', async () => {
    const { app, lines, scrape } = metricsApp();
    await app.request('/metrics');
    const text = await scrape();
    expect(text).not.toContain('route="/metrics"');
    const scrapes = lines.filter((line) => line['path'] === '/metrics');
    expect(scrapes.map((line) => line.severity)).toEqual(['DEBUG', 'DEBUG']);
  });

  it('without a metrics instance (METRICS_ENABLED=false), /metrics is a 404', async () => {
    const { logger } = captureLogger();
    const app = createApp({ core: createCore({ source: 'memory' }), logger });
    expect((await app.request('/metrics')).status).toBe(404);
    expect((await app.request('/trpc/projects.list')).status).toBe(200);
  });
});
