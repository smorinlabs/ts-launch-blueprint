// The API's Hono app (D-043): plain routes for operational endpoints, tRPC for
// the business endpoint. Domain errors are mapped to HTTP codes by every
// procedure (src/errors.ts, D-049); 5xx are logged here with the original
// error, since their client message is generic.
import { trpcServer } from '@hono/trpc-server';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import type { Core } from '@ts-launch-blueprint/core';
import { Hono } from 'hono';

import { appRouter } from './router.js';

/** Writes one server-side error line; the default goes to stderr. Structured
 * logs replace this in the observability work. */
export type ErrorLogger = (line: string) => void;

const stderrLogger: ErrorLogger = (line) => {
  process.stderr.write(`${line}\n`);
};

/** Build the HTTP app over an already-built core. */
export function createApp(deps: { core: Core; logError?: ErrorLogger }): Hono {
  const logError = deps.logError ?? stderrLogger;
  const app = new Hono();

  // Liveness: the process is up.
  app.get('/healthz', (c) => c.json({ status: 'ok' }));
  // Readiness: the core was built. Trivial until a real data source needs a
  // dependency check.
  app.get('/readyz', (c) => c.json({ status: 'ready' }));

  app.use(
    '/trpc/*',
    trpcServer({
      router: appRouter,
      createContext: () => ({ core: deps.core }),
      // 5xx only: 4xx are the caller's, and carry their real message already.
      // Logs the ORIGINAL error (the cause), whose detail the client never sees.
      onError: ({ error, path }) => {
        if (getHTTPStatusCodeFromError(error) < 500) {
          return;
        }
        const original = error.cause ?? error;
        const detail =
          original instanceof Error ? `${original.name}: ${original.message}` : String(original);
        logError(`${path ?? '(unknown procedure)'} failed: ${detail}`);
      },
    })
  );

  return app;
}
