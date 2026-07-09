// Public library entry point. The root export is the only stable API
// surface (D-012(3)): config resolution, the error taxonomy, the API
// client, and the pure output formatter.

export {
  type ApiClient,
  type ApiClientOptions,
  ApiError,
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
  AuthError,
  CliError,
  ConfigError,
  ConflictError,
  EXIT_CODES,
  type ExitCode,
  exitCodeFor,
  NotFoundError,
  UsageError,
} from './lib/errors.js';
export { formatOutput, type OutputFormat, OUTPUT_FORMATS } from './lib/format.js';
export { VERSION } from './version.js';
