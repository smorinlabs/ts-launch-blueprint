// The CLI maps domain errors to the cli-standards R6.1 exit codes via
// exitCodeFor (D-016(2)). Split from the core's domain-error tests so the
// core's tests never import CLI code.
import {
  ApiError,
  AuthError,
  ConfigError,
  ConflictError,
  DomainError,
  ERROR_CODES,
  InterruptError,
  NotFoundError,
} from 'ts-launch-blueprint-core';
import { describe, expect, it } from 'vitest';

import { CliError, EXIT_CODES, exitCodeFor, UsageError } from '../src/cli/exit-codes.js';

describe('exitCodeFor (cli-standards R6.1)', () => {
  it.each([
    ['NotFoundError', new NotFoundError('x'), 3],
    ['AuthError', new AuthError('x'), 4],
    ['ConflictError', new ConflictError('x'), 5],
    ['ApiError', new ApiError('x'), 1],
    ['UsageError', new UsageError('x'), 2],
    ['ConfigError', new ConfigError('x'), 1],
    ['InterruptError', new InterruptError('x'), 130],
    ['CliError with a custom code', new CliError('x', EXIT_CODES.conflict), 5],
    ['plain Error', new Error('unexpected'), 1],
    ['non-error value', 'not-an-error', 1],
  ])('%s -> %i', (_label, err, code) => {
    expect(exitCodeFor(err)).toBe(code);
  });

  it('ConfigError is a core DomainError (not CliError) with TS001 and no exitCode', () => {
    const err = new ConfigError('bad config');
    expect(err).toBeInstanceOf(DomainError);
    expect(err).not.toBeInstanceOf(CliError);
    expect(err.code).toBe(ERROR_CODES.config);
    expect(err).not.toHaveProperty('exitCode');
    expect(exitCodeFor(err)).toBe(EXIT_CODES.error);
  });

  it('CliError and UsageError support optional hint, code, and cause options', () => {
    const cause = new Error('underlying');
    const cliErr = new CliError('failed', EXIT_CODES.conflict, {
      hint: 'retry later',
      code: ERROR_CODES.unexpected,
      cause,
    });
    expect(cliErr.exitCode).toBe(EXIT_CODES.conflict);
    expect(cliErr.hint).toBe('retry later');
    expect(cliErr.code).toBe(ERROR_CODES.unexpected);
    expect(cliErr.cause).toBe(cause);

    const usageErr = new UsageError('bad flag', {
      hint: 'run --help',
      cause,
    });
    expect(usageErr.exitCode).toBe(EXIT_CODES.usage);
    expect(usageErr.hint).toBe('run --help');
    expect(usageErr.code).toBeUndefined();
    expect(usageErr.cause).toBe(cause);

    const plainUsage = new UsageError('bad arg', { code: undefined, hint: undefined });
    expect(plainUsage.hint).toBeUndefined();
    expect(plainUsage.code).toBeUndefined();
  });
});
