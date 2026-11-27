// The app's TanStack Query client (D-055). Retrying a 4xx can't help (the
// workspace still won't exist), and TanStack's default (3 retries with
// backoff) would hold a 404 on "Loading…" for seconds; so only server errors
// retry, at most twice.
import { QueryClient } from '@tanstack/react-query';

import { errorKind } from './projects/errors.js';

/** How many times a server error is retried (so up to 3 requests in all). */
export const MAX_SERVER_RETRIES = 2;

/** TanStack's `retry` callback: `failureCount` is 0 on the first failure. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return errorKind(error) === 'server' && failureCount < MAX_SERVER_RETRIES;
}

/** A query client with the retry policy; tests pass `retryDelay: 0`. */
export function createQueryClient(options: { retryDelay?: number } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        ...(options.retryDelay === undefined ? {} : { retryDelay: options.retryDelay }),
      },
    },
  });
}
