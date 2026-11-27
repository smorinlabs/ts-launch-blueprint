// errorKind: tRPC 404 -> not-found, other 4xx -> bad-request, everything
// else (5xx, network, unknown) -> server.
import { TRPCClientError } from '@trpc/client';
import { describe, expect, it } from 'vitest';

import { errorKind } from '../src/projects/errors.js';

/** A client error as the client builds it from an API error envelope. */
function apiError(code: string, httpStatus: number): TRPCClientError<never> {
  return TRPCClientError.from({
    error: { message: code, code: -32_000, data: { code, httpStatus } },
  });
}

describe('errorKind', () => {
  it.each([
    ['NOT_FOUND', 404, 'not-found'],
    ['BAD_REQUEST', 400, 'bad-request'],
    ['CONFLICT', 409, 'bad-request'],
    ['BAD_GATEWAY', 502, 'server'],
    ['INTERNAL_SERVER_ERROR', 500, 'server'],
  ])('%s (%d) -> %s', (code, httpStatus, kind) => {
    expect(errorKind(apiError(code, httpStatus))).toBe(kind);
  });

  it('a network failure (a client error with no data) -> server', () => {
    expect(errorKind(TRPCClientError.from(new TypeError('fetch failed')))).toBe('server');
  });

  it.each([
    ['a plain Error', new Error('boom')],
    ['a string', 'boom'],
    ['undefined', undefined],
  ])('anything else (%s) -> server', (_label, value) => {
    expect(errorKind(value)).toBe('server');
  });
});
