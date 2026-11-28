// Domain errors carry no transport detail; each controller maps them (the
// CLI's exitCodeFor table is tested in apps/cli/tests/exit-codes.test.ts).
import { describe, expect, it } from 'vitest';

import {
  ApiError,
  AuthError,
  ConfigError,
  ConflictError,
  DomainError,
  ERROR_CODES,
  InterruptError,
  NotFoundError,
  ProjectNotFoundError,
  WorkspaceNotFoundError,
} from '../src/schemas/errors.js';

describe('ERROR_CODES registry', () => {
  it('defines unique append-only TS000–TS006 codes', () => {
    expect(ERROR_CODES).toEqual({
      unexpected: 'TS000',
      config: 'TS001',
      auth: 'TS002',
      api: 'TS003',
      interrupt: 'TS004',
      projectNotFound: 'TS005',
      workspaceNotFound: 'TS006',
    });
    const values = Object.values(ERROR_CODES);
    expect(new Set(values).size).toBe(7);
  });
});

describe('domain errors', () => {
  it.each([
    ['DomainError', new DomainError('x'), ERROR_CODES.unexpected],
    ['ConfigError', new ConfigError('x'), ERROR_CODES.config],
    ['AuthError', new AuthError('x'), ERROR_CODES.auth],
    ['ApiError', new ApiError('x'), ERROR_CODES.api],
    ['InterruptError', new InterruptError('x'), ERROR_CODES.interrupt],
    ['NotFoundError', new NotFoundError('x'), ERROR_CODES.projectNotFound],
    ['ProjectNotFoundError', new ProjectNotFoundError('x'), ERROR_CODES.projectNotFound],
    ['WorkspaceNotFoundError', new WorkspaceNotFoundError('x'), ERROR_CODES.workspaceNotFound],
    ['ConflictError', new ConflictError('x'), ERROR_CODES.unexpected],
  ])(
    '%s keeps its name, default code %s, is a DomainError, and has no exitCode',
    (name, err, code) => {
      expect(err.name).toBe(name);
      expect(err.message).toBe('x');
      expect(err.code).toBe(code);
      expect(err.hint).toBeUndefined();
      expect(err).toBeInstanceOf(DomainError);
      expect(err).toBeInstanceOf(Error);
      expect(err).not.toHaveProperty('exitCode');
    }
  );

  it('ProjectNotFoundError and WorkspaceNotFoundError extend NotFoundError', () => {
    expect(new ProjectNotFoundError('missing project')).toBeInstanceOf(NotFoundError);
    expect(new WorkspaceNotFoundError('missing workspace')).toBeInstanceOf(NotFoundError);
  });

  it('accepts optional hint, cause, and explicit code override without clobbering on undefined', () => {
    const cause = new Error('root cause');
    const withOptions = new ConfigError('bad config', {
      hint: 'Check ts-projects_config.toml',
      cause,
      code: ERROR_CODES.unexpected,
    });
    expect(withOptions.hint).toBe('Check ts-projects_config.toml');
    expect(withOptions.cause).toBe(cause);
    expect(withOptions.code).toBe(ERROR_CODES.unexpected);

    const withUndefinedCode = new AuthError('bad token', {
      code: undefined,
      hint: undefined,
    });
    expect(withUndefinedCode.code).toBe(ERROR_CODES.auth);
    expect(withUndefinedCode.hint).toBeUndefined();
  });
});
