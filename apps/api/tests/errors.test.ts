import { TRPCError } from '@trpc/server';
// toTRPCError: the API's domain-error mapping table (D-049). 4xx keep the
// domain's message; 5xx get a generic one; `cause` is always the original.
import { ApiError, AuthError, ConflictError, NotFoundError } from '@ts-launch-blueprint/core';
import { describe, expect, it } from 'vitest';

import {
  INTERNAL_ERROR_MESSAGE,
  toTRPCError,
  UPSTREAM_AUTH_MESSAGE,
  UPSTREAM_ERROR_MESSAGE,
} from '../src/errors.js';

describe('toTRPCError', () => {
  it.each([
    [
      'NotFoundError',
      new NotFoundError('Workspace not found: nope'),
      'NOT_FOUND',
      'Workspace not found: nope',
    ],
    ['ConflictError', new ConflictError('already exists'), 'CONFLICT', 'already exists'],
    [
      'AuthError',
      new AuthError('token rejected by https://upstream'),
      'BAD_GATEWAY',
      UPSTREAM_AUTH_MESSAGE,
    ],
    [
      'ApiError',
      new ApiError('request to https://upstream timed out'),
      'BAD_GATEWAY',
      UPSTREAM_ERROR_MESSAGE,
    ],
    [
      'a plain Error',
      new Error('db password=hunter2'),
      'INTERNAL_SERVER_ERROR',
      INTERNAL_ERROR_MESSAGE,
    ],
  ])('maps %s to %s with the client-safe message', (_label, original, code, message) => {
    const mapped = toTRPCError(original);
    expect(mapped).toBeInstanceOf(TRPCError);
    expect(mapped.code).toBe(code);
    expect(mapped.message).toBe(message);
    expect(mapped.cause).toBe(original);
  });

  it('maps a non-error value to a generic 500 (tRPC wraps the value in an Error cause)', () => {
    const mapped = toTRPCError('boom');
    expect(mapped.code).toBe('INTERNAL_SERVER_ERROR');
    expect(mapped.message).toBe(INTERNAL_ERROR_MESSAGE);
    expect(mapped.cause?.message).toBe('boom');
  });

  it('passes a TRPCError (e.g. input validation) through unchanged', () => {
    const validation = new TRPCError({ code: 'BAD_REQUEST', message: 'bad input' });
    expect(toTRPCError(validation)).toBe(validation);
  });
});
