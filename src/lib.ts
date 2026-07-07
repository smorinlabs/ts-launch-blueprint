// Public library entry point. The root export is the only stable API
// surface (D-012(3)). S3a adds config resolution and the error taxonomy;
// the API client arrives in S3b.

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
export { VERSION } from './version.js';

// Placeholder domain type stub; fleshed out in S3b (API layer).
export interface Project {
  id: string;
  name: string;
}
