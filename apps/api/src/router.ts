// The API's tRPC router: one business procedure, projects.list, calling the
// same projects service as the CLI. Input and output schemas come only from
// the core's public contract (D-047); no shape is redefined here.
import { ListProjectsInputSchema, ListProjectsOutputSchema } from '@ts-launch-blueprint/core';

import { publicProcedure, router } from './trpc.js';

export const appRouter = router({
  projects: router({
    // A query (a read), so it is served as GET /trpc/projects.list.
    list: publicProcedure
      // .optional(): a GET with no ?input= passes undefined; the bare object schema
      // would reject it with 400 ("expected object, received undefined").
      .input(ListProjectsInputSchema.optional())
      .output(ListProjectsOutputSchema)
      .query(async ({ input, ctx }) => ({
        projects: await ctx.core.projects.listProjects(input),
      })),
  }),
});

/** The router's type, for type-only imports by clients (the future web app). */
export type AppRouter = typeof appRouter;
