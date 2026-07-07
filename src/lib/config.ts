// Layered configuration (D-017): TOML user config via smol-toml, zod v4
// schema validation, precedence --token flag > TS_PROJECTS_TOKEN env >
// config file. This mirrors the Python source's get_config semantics
// (projects.py:120-147): the file tier can never clobber env (python-
// dotenv's no-override default) and get_config re-read the env var after
// loading the file — here the same guarantee is computed functionally,
// without mutating process.env.
//
// Deliberate divergences from the source (documented per plan S3a):
// - .env config tier replaced by TOML `ts-projects_config.toml`
//   (cli-standards R5.2: TOML canonical; D-017(1,5)). The .env→TOML
//   migration note lands in EXAMPLECLI.md (finished in S3b).
// - `--token` alone works: the source raised ConfigError before main()
//   could apply the flag (INDEX-documented quirk); the port validates
//   after all three layers merge, matching the documented behavior.
// - Missing token exits 4 (auth, D-016(2)); the source exited 1.
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse, stringify } from 'smol-toml';
import { z } from 'zod';

import { AuthError, ConfigError, UsageError } from './errors.js';
import { configDir } from './xdg-paths.js';

/** Canonical config file name (cli-standards R5.1, D-029). */
export const CONFIG_FILE_NAME = 'ts-projects_config.toml';

/** Token environment variable (D-029; source: PY_TOKEN). */
export const TOKEN_ENV_VAR = 'TS_PROJECTS_TOKEN';

/** Zod v4 schema for the TOML config file (D-017(4)). */
export const configFileSchema: z.ZodObject<{
  token: z.ZodOptional<z.ZodString>;
  workspace: z.ZodOptional<z.ZodString>;
  limit: z.ZodOptional<z.ZodNumber>;
}> = z.object({
  token: z.string().optional(),
  workspace: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

/** Values a config file may carry. */
export type ConfigFileValues = z.infer<typeof configFileSchema>;

/** Where the effective token came from. */
export type TokenSource = 'flag' | 'env' | 'file' | 'none';

/** Effective merged configuration. */
export interface ResolvedConfig {
  token: string | undefined;
  workspace: string | undefined;
  limit: number | undefined;
  tokenSource: TokenSource;
  /** Config file actually read, if any. */
  configPath: string | undefined;
}

/** Minimal fs surface used by config resolution (node:fs satisfies it). */
export interface ConfigFs {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf8') => string;
  statSync: (path: string) => { mode: number };
  mkdirSync: (path: string, options: { recursive: true }) => unknown;
  writeFileSync: (path: string, data: string, options: { mode?: number }) => void;
  chmodSync: (path: string, mode: number) => void;
}

const realFs: ConfigFs = {
  existsSync,
  readFileSync,
  statSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
};

/** Inputs to config resolution; everything injectable for tests. */
export interface ResolveConfigOptions {
  /** --token flag value (highest precedence). */
  flagToken?: string | undefined;
  /** --config flag value; REPLACES discovery (cli-standards R5.4) and
   * must exist, mirroring the source's click.Path(exists=True). */
  configPathFlag?: string | undefined;
  env: Record<string, string | undefined>;
  homedir: () => string;
  fs?: ConfigFs | undefined;
  /** Sink for the non-fatal loose-permissions warning. */
  warn?: ((message: string) => void) | undefined;
  /** Platform override for tests; defaults to process.platform. */
  platform?: string | undefined;
}

/** Default user config file path (discovery tier). */
export function defaultConfigPath(
  env: Record<string, string | undefined>,
  homedir: () => string
): string {
  return join(configDir(env, homedir), CONFIG_FILE_NAME);
}

function readConfigFile(
  path: string,
  fs: ConfigFs,
  warn: ((message: string) => void) | undefined,
  platform: string
): ConfigFileValues {
  let raw: string;
  try {
    raw = fs.readFileSync(path, 'utf8');
  } catch (err) {
    throw new ConfigError(
      `Could not read config file ${path}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (err) {
    throw new ConfigError(
      `Invalid TOML in config file ${path}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const result = configFileSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new ConfigError(`Invalid config file ${path}: ${details}`);
  }
  // Non-fatal loose-permissions warning for token-bearing files (D-017(6);
  // POSIX only — Windows fs modes cannot express group/other access).
  if (result.data.token !== undefined && platform !== 'win32' && warn !== undefined) {
    const mode = fs.statSync(path).mode;
    if ((mode & 0o077) !== 0) {
      warn(`Config file ${path} is readable by group/others; restrict it with: chmod 600 ${path}`);
    }
  }
  return result.data;
}

/**
 * Resolve the effective configuration with the D-017 precedence:
 * --token flag > TS_PROJECTS_TOKEN env > config file. Empty-string env
 * values are treated as unset (parity with Python's falsy os.getenv use).
 */
export function resolveConfig(options: ResolveConfigOptions): ResolvedConfig {
  const fs = options.fs ?? realFs;
  const platform = options.platform ?? process.platform;

  let configPath: string | undefined;
  if (options.configPathFlag !== undefined) {
    if (!fs.existsSync(options.configPathFlag)) {
      // click.Path(exists=True) parity: a usage error, exit 2.
      throw new UsageError(`Config file does not exist: ${options.configPathFlag}`);
    }
    configPath = options.configPathFlag;
  } else {
    const discovered = defaultConfigPath(options.env, options.homedir);
    if (fs.existsSync(discovered)) {
      configPath = discovered;
    }
  }

  const fileValues: ConfigFileValues =
    configPath !== undefined ? readConfigFile(configPath, fs, options.warn, platform) : {};

  const envToken = options.env[TOKEN_ENV_VAR];
  let token: string | undefined;
  let tokenSource: TokenSource = 'none';
  if (options.flagToken !== undefined && options.flagToken !== '') {
    token = options.flagToken;
    tokenSource = 'flag';
  } else if (envToken !== undefined && envToken !== '') {
    token = envToken;
    tokenSource = 'env';
  } else if (fileValues.token !== undefined && fileValues.token !== '') {
    token = fileValues.token;
    tokenSource = 'file';
  }

  return {
    token,
    workspace: fileValues.workspace,
    limit: fileValues.limit,
    tokenSource,
    configPath,
  };
}

/**
 * Actionable three-remedy missing-token message, ported from
 * projects.py:88-105 and adapted to the TS names (D-017(5), D-029).
 */
export function missingTokenMessage(
  env: Record<string, string | undefined>,
  homedir: () => string
): string {
  const path = defaultConfigPath(env, homedir);
  return [
    `No ${TOKEN_ENV_VAR} found in environment or config file.`,
    'To set your ts-projects token, you have three options:',
    '1. Use the --token option when running the command:',
    '   ts-projects --token your_token_here',
    `2. Set the ${TOKEN_ENV_VAR} environment variable:`,
    `   export ${TOKEN_ENV_VAR}=your_token_here`,
    `3. Add it to the config file ${path}:`,
    '   token = "your_token_here"',
    `   Then restrict access with: chmod 600 ${path}`,
    '   (Windows note: chmod cannot scope file modes there; your',
    '   %USERPROFILE% ACLs already limit the file to your account.)',
    'You can get your token from: https://app.ts.com/settings/tokens',
  ].join('\n');
}

/**
 * Enforce token presence AFTER all three layers merged (fixes the
 * source quirk where --token alone failed). Missing token -> AuthError
 * (exit 4 per D-016(2)).
 */
export function requireToken(
  config: ResolvedConfig,
  env: Record<string, string | undefined>,
  homedir: () => string
): string {
  if (config.token === undefined) {
    throw new AuthError(missingTokenMessage(env, homedir));
  }
  return config.token;
}

/** Mask a secret for display (cli-standards R5.6). */
export function redactToken(token: string): string {
  if (token.length > 8) {
    return `***${token.slice(-4)}`;
  }
  return '***';
}

/**
 * Write the user config file, creating the directory as needed. Sets
 * mode 0o600 on POSIX (D-017(6)); on Windows fs modes cannot express
 * user/group/other so the mode is skipped and profile ACLs apply.
 * Returns the path written.
 */
export function writeUserConfig(
  values: ConfigFileValues,
  options: {
    env: Record<string, string | undefined>;
    homedir: () => string;
    fs?: ConfigFs | undefined;
    platform?: string | undefined;
  }
): string {
  const fs = options.fs ?? realFs;
  const platform = options.platform ?? process.platform;
  const dir = configDir(options.env, options.homedir);
  const path = join(dir, CONFIG_FILE_NAME);
  fs.mkdirSync(dir, { recursive: true });
  const data = `${stringify(values)}\n`;
  if (platform === 'win32') {
    fs.writeFileSync(path, data, {});
  } else {
    fs.writeFileSync(path, data, { mode: 0o600 });
    // writeFileSync applies mode only at creation; chmod covers rewrite.
    fs.chmodSync(path, 0o600);
  }
  return path;
}
