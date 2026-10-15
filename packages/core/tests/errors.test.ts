// Domain errors carry no transport detail; each controller maps them (the
// CLI's exitCodeFor table is tested in apps/cli/tests/exit-codes.test.ts).
import { describe, expect, it } from 'vitest';

import {
  ApiError,
  AuthError,
  ConflictError,
  DomainError,
  NotFoundError,
} from '../src/schemas/errors.js';

describe('domain errors', () => {
  it.each([
    ['NotFoundError', new NotFoundError('x')],
    ['AuthError', new AuthError('x')],
    ['ConflictError', new ConflictError('x')],
    ['ApiError', new ApiError('x')],
  ])('%s keeps its name, is a DomainError, and has no exitCode', (name, err) => {
    expect(err.name).toBe(name);
    expect(err.message).toBe('x');
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toHaveProperty('exitCode');
  });

  it('DomainError base keeps its own name', () => {
    expect(new DomainError('x').name).toBe('DomainError');
  });
});
