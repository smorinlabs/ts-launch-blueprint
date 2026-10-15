// The CLI maps domain errors to the cli-standards R6.1 exit codes via
// exitCodeFor (D-016(2)). Split from the core's domain-error tests so the
// core's tests never import CLI code.
import { ApiError, AuthError, ConflictError, NotFoundError } from '@ts-launch-blueprint/core';
import { describe, expect, it } from 'vitest';

import {
  CliError,
  ConfigError,
  EXIT_CODES,
  exitCodeFor,
  UsageError,
} from '../src/cli/exit-codes.js';

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
