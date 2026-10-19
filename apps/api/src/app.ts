// The API's Hono app (D-043): plain routes for operational endpoints, tRPC for
// the business endpoint. No error mapping yet: a domain error such as
// NotFoundError comes back as tRPC INTERNAL_SERVER_ERROR (500); P2-3 maps
// domain errors to proper codes.
import { trpcServer } from '@hono/trpc-server';
import type { Core } from '@ts-launch-blueprint/core';
import { Hono } from 'hono';

import { appRouter } from './router.js';

/** Build the HTTP app over an already-built core. */
export function createApp(deps: { core: Core }): Hono {
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
    })
  );

  return app;
}
