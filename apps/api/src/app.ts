// The API's Hono app (D-043): plain routes for operational endpoints, tRPC for
// the business endpoint. Every request is logged as one JSON line by the
// request middleware (src/request-log.ts, D-051). Domain errors are mapped to
// HTTP codes by every procedure (src/errors.ts, D-049); 5xx are logged with the
// original error, since their client message is generic. Non-tRPC HTTP errors
// (404, 429, 500, 503) return RFC 9457 application/problem+json. With a metrics
// instance, requests and tRPC errors are counted and served at /metrics
// (src/metrics.ts, D-052). With tracing on, every request gets a server span
// that wraps the rest (src/tracing.ts, D-053). Unsafe requests carrying an
// `Idempotency-Key` header replay cached 2xx responses (src/idempotency.ts, Q8.A).
import { trpcServer } from '@hono/trpc-server';
import type { AnyTRPCRouter } from '@trpc/server';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import type { Core } from '@ts-launch-blueprint/core';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';

import type { RateLimitConfig } from './config.js';
import { INTERNAL_ERROR_MESSAGE } from './errors.js';
import { idempotency, type IdempotencyOptions } from './idempotency.js';
import type { Logger } from './logger.js';
import { METRICS_PATH, type Metrics, procedureLabel } from './metrics.js';
import { problemResponse } from './problems.js';
import { rateLimit } from './rate-limit.js';
import { requestLog, type RequestLogVariables } from './request-log.js';
import { appRouter } from './router.js';
import type { Tracing } from './tracing.js';
import { VERSION } from './version.js';

/** Individual dependency/runtime check reported by `GET /readyz`. */
export interface ReadinessCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  detail?: string | undefined;
}

/** Build the HTTP app over an already-built core and a logger. */
export function createApp(deps: {
  core: Core;
  logger: Logger;
  gcpProjectId?: string | undefined;
  metrics?: Metrics | undefined;
  tracing?: Tracing | undefined;
  corsOrigins?: readonly string[] | undefined;
  rateLimit?: RateLimitConfig | undefined;
  checkReadiness?: (() => Promise<ReadinessCheck[]> | ReadinessCheck[]) | undefined;
  version?: string | undefined;
  idempotency?: IdempotencyOptions | undefined;
  router?: AnyTRPCRouter | undefined;
}): Hono<{ Variables: RequestLogVariables }> {
  const app = new Hono<{ Variables: RequestLogVariables }>();
  const hasCors = deps.corsOrigins !== undefined && deps.corsOrigins.length > 0;

  // 1. Outermost: security headers on all responses (including 429, 404, OPTIONS, 500, 503).
  app.use(
    '*',
    secureHeaders({
      xFrameOptions: 'DENY',
      strictTransportSecurity: 'max-age=63072000; includeSubDomains',
      referrerPolicy: 'no-referrer',
      xContentTypeOptions: 'nosniff',
      overwrite: false,
      crossOriginResourcePolicy: hasCors ? 'cross-origin' : true,
    })
  );

  // 2. When on: the server span, so the request log and metrics run inside it.
  if (deps.tracing?.enabled === true) {
    app.use('*', deps.tracing.httpMiddleware());
  }

  // 3. Request ID, trace fields, child logger, one line per request.
  app.use('*', requestLog({ logger: deps.logger, gcpProjectId: deps.gcpProjectId }));

  // 4. Request count and duration by route pattern (runs before CORS/rate-limit so rejections are counted).
  const { metrics } = deps;
  if (metrics !== undefined) {
    app.use('*', metrics.middleware());
  }

  // 5. Opt-in CORS (only mounted when CORS_ORIGINS is non-empty).
  if (hasCors && deps.corsOrigins !== undefined) {
    app.use(
      '*',
      cors({
        origin: deps.corsOrigins.includes('*') ? '*' : [...deps.corsOrigins],
      })
    );
  }

  // 6. Opt-in rate limiting (only mounted when RATE_LIMIT is configured).
  if (deps.rateLimit !== undefined) {
    app.use('*', rateLimit(deps.rateLimit));
  }

  // Scrape endpoint registered after global CORS/rate-limit middleware.
  if (metrics !== undefined) {
    app.get(METRICS_PATH, async (c) =>
      c.body(await metrics.registry.metrics(), 200, {
        'Content-Type': metrics.registry.contentType,
      })
    );
  }

  // Idempotency-Key replay middleware for POST/PUT/PATCH requests (Q8.A).
  app.use('*', idempotency(deps.idempotency));

  // Replaces Hono's default handler, which console.error()s the stack outside
  // the JSON logs. The detail goes to the log; the client gets RFC 9457 Problem Details.
  app.onError((err, c) => {
    const reqLogger = (c.get('logger') as Logger | undefined) ?? deps.logger;
    reqLogger.error({ err: { name: err.name, message: err.message } }, 'handler failed');
    return problemResponse(c, {
      status: 500,
      title: 'Internal Server Error',
      detail: INTERNAL_ERROR_MESSAGE,
    });
  });

  app.notFound((c) =>
    problemResponse(c, {
      status: 404,
      title: 'Not Found',
      detail: `Route not found: ${c.req.path}`,
    })
  );

  // Liveness: the process is up.
  app.get('/healthz', (c) =>
    c.json({
      status: 'ok',
      version: deps.version ?? VERSION,
      runtime: process.version,
    })
  );

  // Readiness: injectable checks; returns 503 application/problem+json on error.
  app.get('/readyz', async (c) => {
    let checks: ReadinessCheck[];
    try {
      checks = deps.checkReadiness
        ? await deps.checkReadiness()
        : [
            { name: 'runtime', status: 'ok', detail: process.version },
            { name: 'core', status: 'ok', detail: 'initialized' },
          ];
    } catch (err) {
      const reqLogger = (c.get('logger') as Logger | undefined) ?? deps.logger;
      reqLogger.error(
        { err: err instanceof Error ? { name: err.name, message: err.message } : String(err) },
        'readiness check failed'
      );
      checks = [{ name: 'readiness', status: 'error', detail: 'Readiness check failed' }];
    }
    if (checks.some((check) => check.status === 'error')) {
      return problemResponse(c, {
        status: 503,
        title: 'Service Unavailable',
        detail: 'Readiness checks failed.',
        extensions: { checks },
      });
    }
    return c.json({ status: 'ready', checks });
  });

  app.use(
    '/trpc/*',
    trpcServer({
      router: deps.router ?? appRouter,
      createContext: (_opts, c) => ({
        core: deps.core,
        requestId: c.get('requestId'),
        logger: c.get('logger'),
      }),
      // Counts every tRPC error (4xx too: a rising NOT_FOUND rate is worth
      // seeing), under a known procedure name or `unknown`. Logs 5xx only: 4xx
      // are the caller's, and carry their real message already. Logs the
      // ORIGINAL error (the cause), whose detail the client never sees.
      onError: ({ error, path, ctx }) => {
        metrics?.recordTrpcError(procedureLabel(path), error.code);
        if (getHTTPStatusCodeFromError(error) < 500) {
          return;
        }
        const original = error.cause ?? error;
        const err =
          original instanceof Error
            ? { name: original.name, message: original.message }
            : { name: 'Error', message: String(original) };
        (ctx?.logger ?? deps.logger).error(
          { requestId: ctx?.requestId, procedure: path ?? '(unknown procedure)', err },
          'procedure failed'
        );
      },
    })
  );

  return app;
}
