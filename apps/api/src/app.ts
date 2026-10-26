// The API's Hono app (D-043): plain routes for operational endpoints, tRPC for
// the business endpoint. Every request is logged as one JSON line by the
// request middleware (src/request-log.ts, D-051). Domain errors are mapped to
// HTTP codes by every procedure (src/errors.ts, D-049); 5xx are logged with the
// original error, since their client message is generic.
import { trpcServer } from '@hono/trpc-server';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import type { Core } from '@ts-launch-blueprint/core';
import { Hono } from 'hono';

import type { Logger } from './logger.js';
import { requestLog, type RequestLogVariables } from './request-log.js';
import { appRouter } from './router.js';

/** Build the HTTP app over an already-built core and a logger. */
export function createApp(deps: {
  core: Core;
  logger: Logger;
  gcpProjectId?: string | undefined;
}): Hono<{ Variables: RequestLogVariables }> {
  const app = new Hono<{ Variables: RequestLogVariables }>();

  // First: request ID, trace fields, child logger, one line per request.
  app.use('*', requestLog({ logger: deps.logger, gcpProjectId: deps.gcpProjectId }));

  // Replaces Hono's default handler, which console.error()s the stack outside
  // the JSON logs. The detail goes to the log; the client gets no detail.
  app.onError((err, c) => {
    c.get('logger').error({ err: { name: err.name, message: err.message } }, 'handler failed');
    return c.json({ error: 'Internal server error' }, 500);
  });

  // Liveness: the process is up.
  app.get('/healthz', (c) => c.json({ status: 'ok' }));
  // Readiness: the core was built. Trivial until a real data source needs a
  // dependency check.
  app.get('/readyz', (c) => c.json({ status: 'ready' }));

  app.use(
    '/trpc/*',
    trpcServer({
      router: appRouter,
      createContext: (_opts, c) => ({
        core: deps.core,
        requestId: c.get('requestId'),
        logger: c.get('logger'),
      }),
      // 5xx only: 4xx are the caller's, and carry their real message already.
      // Logs the ORIGINAL error (the cause), whose detail the client never sees.
      onError: ({ error, path, ctx }) => {
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
