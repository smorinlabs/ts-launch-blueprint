// The retry policy: 4xx never retried, server errors at most twice.
import { TRPCClientError } from '@trpc/client';
import { describe, expect, it } from 'vitest';

import { createQueryClient, MAX_SERVER_RETRIES, shouldRetry } from '../src/query-client.js';

const apiError = (code: string, httpStatus: number): TRPCClientError<never> =>
  TRPCClientError.from({ error: { message: code, code: -32_000, data: { code, httpStatus } } });

describe('retry policy', () => {
  it('never retries a 4xx', () => {
    expect(shouldRetry(0, apiError('NOT_FOUND', 404))).toBe(false);
    expect(shouldRetry(0, apiError('BAD_REQUEST', 400))).toBe(false);
  });

  it('retries a server error twice (failureCount 0 and 1), then stops', () => {
    const error = apiError('BAD_GATEWAY', 502);
    expect([0, 1, 2].map((count) => shouldRetry(count, error))).toEqual([true, true, false]);
    expect(MAX_SERVER_RETRIES).toBe(2);
  });

  it('createQueryClient uses the policy, and the retry delay when given', () => {
    const defaults = createQueryClient({ retryDelay: 0 }).getDefaultOptions().queries;
    expect(defaults?.retry).toBe(shouldRetry);
    expect(defaults?.retryDelay).toBe(0);
    expect(createQueryClient().getDefaultOptions().queries).not.toHaveProperty('retryDelay');
  });
});
