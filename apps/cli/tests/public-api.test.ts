// Locks the public library surface of src/lib.ts, the only stable API
// (D-012(3)). Changing either list below is a deliberate public API
// change: it needs a Conventional Commit marked as breaking (`feat!:` /
// `BREAKING CHANGE:`) so release-please bumps the version correctly.
import { describe, expect, it } from 'vitest';

import * as lib from '../src/lib.js';
import type {
  ApiClient,
  ApiClientOptions,
  CliErrorOptions,
  ConfigFileValues,
  ConfigFs,
  DomainErrorOptions,
  ErrorCode,
  ExitCode,
  OutputFormat,
  Project,
  ResolveConfigOptions,
  ResolvedConfig,
  TokenSource,
  Workspace,
} from '../src/lib.js';

describe('public API surface (D-012(3))', () => {
  it('src/lib.ts exports exactly the expected runtime names', () => {
    const names = Object.keys(lib);
    names.sort();
    expect(names).toEqual([
      'ApiError',
      'AuthError',
      'BASE_URL',
      'CONFIG_FILE_NAME',
      'CliError',
      'ConfigError',
      'ConflictError',
      'DEFAULT_LIMIT',
      'DEFAULT_TIMEOUT_MS',
      'ERROR_CODES',
      'EXIT_CODES',
      'InterruptError',
      'NotFoundError',
      'OUTPUT_FORMATS',
      'ProjectNotFoundError',
      'TOKEN_ENV_VAR',
      'UsageError',
      'VERSION',
      'WorkspaceNotFoundError',
      'configFileSchema',
      'createApiClient',
      'defaultConfigPath',
      'exitCodeFor',
      'formatOutput',
      'missingTokenMessage',
      'redactToken',
      'relativeTime',
      'requireToken',
      'resolveConfig',
      'richLink',
      'writeUserConfig',
    ]);
  });

  it('src/lib.ts exports the expected types and excludes file from TokenSource', () => {
    type _AssertTokenSource =
      Exclude<TokenSource, 'flag' | 'env' | 'none'> extends never ? true : never;
    const _tokenSourceExact: _AssertTokenSource = true;

    type _Surface = [
      ApiClient,
      ApiClientOptions,
      CliErrorOptions,
      ConfigFileValues,
      ConfigFs,
      DomainErrorOptions,
      ErrorCode,
      ExitCode,
      OutputFormat,
      Project,
      ResolveConfigOptions,
      ResolvedConfig,
      TokenSource,
      Workspace,
    ];
    expect(_tokenSourceExact).toBe(true);
    expect(lib.OUTPUT_FORMATS).toEqual(['text', 'json', 'csv', 'markdown']);
  });
});
