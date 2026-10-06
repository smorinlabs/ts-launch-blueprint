// Domain errors carry no transport detail; the CLI maps them to the
// cli-standards R6.1 exit codes via exitCodeFor (D-016(2)).
import { describe, expect, it } from 'vitest';

import {
  CliError,
  ConfigError,
  EXIT_CODES,
  exitCodeFor,
  UsageError,
} from '../../src/cli/exit-codes.js';
import {
  ApiError,
  AuthError,
  ConflictError,
  DomainError,
  NotFoundError,
} from '../../src/core/schemas/errors.js';

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

describe('exitCodeFor (cli-standards R6.1)', () => {
  it.each([
    ['NotFoundError', new NotFoundError('x'), 3],
    ['AuthError', new AuthError('x'), 4],
    ['ConflictError', new ConflictError('x'), 5],
    ['ApiError', new ApiError('x'), 1],
    ['UsageError', new UsageError('x'), 2],
    ['ConfigError', new ConfigError('x'), 1],
    ['CliError with a custom code', new CliError('x', EXIT_CODES.conflict), 5],
    ['plain Error', new Error('unexpected'), 1],
    ['non-error value', 'not-an-error', 1],
  ])('%s -> %i', (_label, err, code) => {
    expect(exitCodeFor(err)).toBe(code);
  });
});
