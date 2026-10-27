// Prometheus metrics for the API (D-052): a per-app Registry (never
// prom-client's global one, so every app and test is isolated), request
// count and duration by route pattern, and tRPC errors by procedure and code.
// Labels only ever hold values from small fixed sets: a raw path or a
// caller-sent procedure name would create a new time series per URL, so
// unknown ones fall into `unmatched` / `unknown` buckets.
import type { MiddlewareHandler } from 'hono';
import { matchedRoutes } from 'hono/route';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

import { appRouter } from './router.js';

/** The scrape endpoint; its own requests aren't counted. */
export const METRICS_PATH = '/metrics';

/** The router's procedure names (e.g. `projects.list`). */
export const KNOWN_PROCEDURES: ReadonlySet<string> = new Set(
  Object.keys(appRouter._def.procedures)
);

const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];
// app.use('*', …) middlewares show up in matchedRoutes with this path.
const MIDDLEWARE_PATH = '/*';
const TRPC_MOUNT = '/trpc/*';
const TRPC_PREFIX = '/trpc/';

/** A procedure name for a label: known names as-is, anything else `unknown`. */
export function procedureLabel(
  name: string | undefined,
  known: ReadonlySet<string> = KNOWN_PROCEDURES
): string {
  return name !== undefined && known.has(name) ? name : 'unknown';
}

/**
 * The `route` label: the matched route pattern, never the raw path.
 * `matchedPaths` are the paths of Hono's matched routes; only the `/*`
 * middlewares matched means no route did (`unmatched`). Under the tRPC
 * mount, the procedure part is split on `,` (batching): one known name gives
 * `/trpc/<name>`, several known names `/trpc/batch`, and any unknown or empty
 * name `/trpc/unknown`.
 */
export function routeLabel(
  matchedPaths: readonly string[],
  requestPath: string,
  known: ReadonlySet<string> = KNOWN_PROCEDURES
): string {
  const route = matchedPaths.filter((path) => path !== MIDDLEWARE_PATH).at(-1);
  if (route === undefined) {
    return 'unmatched';
  }
  if (route !== TRPC_MOUNT) {
    return route;
  }
  const names = requestPath.slice(TRPC_PREFIX.length).split(',');
  if (!names.every((name) => known.has(name))) {
    return '/trpc/unknown';
  }
  return names.length === 1 ? `${TRPC_PREFIX}${names[0]}` : '/trpc/batch';
}

/** The app's metrics: the registry to scrape, the request middleware, and
 * the tRPC error counter. */
export interface Metrics {
  registry: Registry;
  middleware(): MiddlewareHandler;
  recordTrpcError(procedure: string, code: string): void;
}

/** Build a metrics instance with its own registry; `collectDefaults` adds
 * prom-client's default Node metrics (CPU, memory, event loop, heap, GC). */
export function createMetrics(options: { collectDefaults: boolean }): Metrics {
  const registry = new Registry();
  if (options.collectDefaults) {
    collectDefaultMetrics({ register: registry });
  }
  const requests = new Counter({
    name: 'http_requests_total',
    help: 'HTTP requests handled, by method, route pattern and status',
    labelNames: ['method', 'route', 'status'],
    registers: [registry],
  });
  const duration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Time from request start to response, by method, route pattern and status',
    labelNames: ['method', 'route', 'status'],
    buckets: DURATION_BUCKETS,
    registers: [registry],
  });
  const trpcErrors = new Counter({
    name: 'trpc_errors_total',
    help: 'tRPC errors (4xx and 5xx), by procedure and tRPC code',
    labelNames: ['procedure', 'code'],
    registers: [registry],
  });

  return {
    registry,
    // A thrown handler error is already a 500 by the time next() returns
    // (Hono / app.onError), so the status is read after it, no try/rethrow.
    middleware: () => async (c, next) => {
      if (c.req.path === METRICS_PATH) {
        await next();
        return;
      }
      const started = performance.now();
      await next();
      const labels = {
        method: c.req.method,
        route: routeLabel(
          matchedRoutes(c).map((route) => route.path),
          c.req.path
        ),
        status: String(c.res.status),
      };
      requests.inc(labels);
      duration.observe(labels, (performance.now() - started) / 1000);
    },
    recordTrpcError: (procedure, code) => {
      trpcErrors.inc({ procedure, code });
    },
  };
}
