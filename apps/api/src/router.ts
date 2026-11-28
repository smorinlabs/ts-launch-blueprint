// The API's tRPC router: projects.list and projects.get, calling the same
// projects service as the CLI. Input and output schemas come from the core's
// public contract (D-047), with MAX_API_LIMIT enforced at the API edge (Q7.A).
import {
  GetProjectInputSchema,
  GetProjectOutputSchema,
  ListProjectsInputSchema,
  ListProjectsOutputSchema,
} from 'ts-launch-blueprint-core';
import { z } from 'zod';

import { publicProcedure, router } from './trpc.js';

/** Maximum page size enforced at the HTTP/tRPC boundary (Q7.A; Py OpenAPI parity).
 * `packages/core` and `apps/cli` stay uncapped (`DEFAULT_LIMIT = 200`). */
export const MAX_API_LIMIT = 100;

const ApiListProjectsInputSchema = ListProjectsInputSchema.extend({
  limit: z.number().int().positive().max(MAX_API_LIMIT).optional(),
});

export const appRouter = router({
  projects: router({
    // Queries (reads), served as GET /trpc/projects.list and GET /trpc/projects.get.
    list: publicProcedure
      // .optional(): a GET with no ?input= passes undefined; the bare object schema
      // would reject it with 400 ("expected object, received undefined").
      .input(ApiListProjectsInputSchema.optional())
      .output(ListProjectsOutputSchema)
      .query(({ input, ctx }) =>
        ctx.core.projects.listProjects({
          ...input,
          limit: input?.limit ?? MAX_API_LIMIT,
        })
      ),

    get: publicProcedure
      .input(GetProjectInputSchema)
      .output(GetProjectOutputSchema)
      .query(async ({ input, ctx }) => ({
        project: await ctx.core.projects.getProject(input.id),
      })),
  }),
});

/** The router's type, for type-only imports by clients (the web app). */
export type AppRouter = typeof appRouter;
