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
  type Project,
  type Workspace,
} from './lib/api.js';
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
} from './lib/config.js';
export {
  CliError,
  ConfigError,
  EXIT_CODES,
  type ExitCode,
  exitCodeFor,
  UsageError,
} from './cli/exit-codes.js';
export { ApiError, AuthError, ConflictError, NotFoundError } from './core/schemas/errors.js';
export { formatOutput, type OutputFormat, OUTPUT_FORMATS } from './lib/format.js';
export { VERSION } from './version.js';
