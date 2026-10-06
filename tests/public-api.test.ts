// Locks the public library surface of src/lib.ts, the only stable API
// (D-012(3)). Changing either list below is a deliberate public API
// change: it needs a Conventional Commit marked as breaking (`feat!:` /
// `BREAKING CHANGE:`) so release-please bumps the version correctly.
import { describe, expect, it } from 'vitest';

import * as lib from '../src/lib.js';
import type {
  ApiClient,
  ApiClientOptions,
  ConfigFileValues,
  ConfigFs,
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
    // Sorted in place: tsconfig's ES2022 lib has no toSorted(), and
    // unicorn(no-array-sort) only allows sort() as its own statement.
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
      'EXIT_CODES',
      'NotFoundError',
      'OUTPUT_FORMATS',
      'TOKEN_ENV_VAR',
      'UsageError',
      'VERSION',
      'configFileSchema',
      'createApiClient',
      'defaultConfigPath',
      'exitCodeFor',
      'formatOutput',
      'missingTokenMessage',
      'redactToken',
      'requireToken',
      'resolveConfig',
      'writeUserConfig',
    ]);
  });

  it('src/lib.ts exports the expected types', () => {
    // Compile-time guard: this file fails `tsc --noEmit` if any type above is
    // removed or renamed. The tuple below just marks the imports as used.
    type _Surface = [
      ApiClient,
      ApiClientOptions,
      ConfigFileValues,
      ConfigFs,
      ExitCode,
      OutputFormat,
      Project,
      ResolveConfigOptions,
      ResolvedConfig,
      TokenSource,
      Workspace,
    ];
    expect(true).toBe(true);
  });
});
