// End-to-end types, checked by tsc (`just typecheck`): what the web client
// gets from projects.list is exactly the core's ListProjectsOutput. Fails if
// the API router, the procedure or the shared contract drift apart.
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@ts-launch-blueprint/api/router';
import type { ListProjectsOutput } from '@ts-launch-blueprint/core';
import { describe, expectTypeOf, it } from 'vitest';

describe('end-to-end types', () => {
  it("the client's projects.list output equals the core's ListProjectsOutput", () => {
    expectTypeOf<
      inferRouterOutputs<AppRouter>['projects']['list']
    >().toEqualTypeOf<ListProjectsOutput>();
  });
});
