// The typed tRPC client (D-054). AppRouter is imported as a TYPE only,
// through the API's types-only `./router` export, so no API code can reach
// the bundle ([web-types-only-from-api]). Batching is on (httpBatchLink): the
// API labels several calls in one request /trpc/batch (D-052).
import { createTRPCClient, httpBatchLink, type TRPCClient } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import type { AppRouter } from '@ts-launch-blueprint/api/router';

/** The React provider and hook for the typed client (TanStack Query). */
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

/** A tRPC client calling `<baseUrl>/trpc`. */
export function createApiClient(baseUrl: string): TRPCClient<AppRouter> {
  return createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: `${baseUrl}/trpc` })] });
}
