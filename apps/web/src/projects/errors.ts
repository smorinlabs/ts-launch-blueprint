// Sorting a failed query into what the UI can do about it (D-055). The API
// maps domain errors to tRPC codes and HTTP statuses (D-049); the client sees
// them as `data.code` and `data.httpStatus` on a TRPCClientError.
import { isTRPCClientError } from '@trpc/client';

/** What kind of failure a query hit:
 * - `not-found`: the thing asked for doesn't exist (offer to clear it);
 * - `bad-request`: the input was rejected (another 4xx; retrying won't help);
 * - `server`: a 5xx, a network failure or anything unknown (worth a retry). */
export type ErrorKind = 'not-found' | 'bad-request' | 'server';

/** The kind of a query error; anything that isn't a tRPC 4xx is `server`. */
export function errorKind(error: unknown): ErrorKind {
  if (!isTRPCClientError(error)) {
    return 'server';
  }
  const data = error.data as { code?: unknown; httpStatus?: unknown } | null | undefined;
  if (data?.code === 'NOT_FOUND') {
    return 'not-found';
  }
  const status = data?.httpStatus;
  return typeof status === 'number' && status >= 400 && status < 500 ? 'bad-request' : 'server';
}
