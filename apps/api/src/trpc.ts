import { initTRPC } from '@trpc/server';
// tRPC setup for the API controller (D-043). The context carries the core,
// built once at startup by the composition root and passed in by createApp.
import type { Core } from '@ts-launch-blueprint/core';

/** Per-request context: the shared core (services over a repository). */
export interface ApiContext {
  core: Core;
}

const t = initTRPC.context<ApiContext>().create({
  // Never put stack traces (with file paths) in error responses, whatever
  // NODE_ENV says: tRPC adds data.stack unless NODE_ENV=production.
  isDev: false,
});

export const router = t.router;
export const publicProcedure = t.procedure;
