// Public library entry point. The root export is the only stable API
// surface (D-012(3)): config resolution, the error taxonomy, the API
// client, and the pure output formatter.

export {
  type ApiClient,
  type ApiClientOptions,
  BASE_URL,
  createApiClient,
  DEFAULT_LIMIT,
  DEFAULT_TIMEOUT_MS,
} from './api.js';
export {
  CONFIG_FILE_NAME,
  type ConfigFileValues,
  type ConfigFs,
  configFileSchema,
  defaultConfigPath,
  missingTokenMessage,
  redactToken,
  requireToken,
  type ResolveConfigOptions,
  type ResolvedConfig,
  resolveConfig,
  TOKEN_ENV_VAR,
  type TokenSource,
  writeUserConfig,
} from './cli/config.js';
export {
  CliError,
  type CliErrorOptions,
  EXIT_CODES,
  type ExitCode,
  exitCodeFor,
  UsageError,
} from './cli/exit-codes.js';
export {
  ApiError,
  AuthError,
  ConfigError,
  ConflictError,
  type DomainErrorOptions,
  ERROR_CODES,
  type ErrorCode,
  InterruptError,
  NotFoundError,
  ProjectNotFoundError,
  WorkspaceNotFoundError,
} from '@ts-launch-blueprint/core';
export type { Project, Workspace } from '@ts-launch-blueprint/core';
export {
  formatOutput,
  type OutputFormat,
  OUTPUT_FORMATS,
  relativeTime,
  richLink,
} from './cli/format.js';
export { VERSION } from './version.js';
