// Layered configuration (ADR 0002 & ADR 0004):
// - Tokens: --token flag > TS_PROJECTS_TOKEN env only (never read from or written to TOML).
// - Discovery: system (reversed systemConfigFiles) -> user (configFile) -> project (projectConfigFile).
// - Degradation: invalid discovered layers or invalid setting keys emit warnings and drop only the
//   offending layer/key; explicit --config / TS_PROJECTS_CONFIG tolerates missing files and raises
//   ConfigError (TS001) on unreadable or invalid TOML.
// - Atomic writes: temp + fsync + rename (0o600 POSIX) with corrupt-file write refusal.
// cspell:ignore gettable settable fsync
import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { posix, win32 } from 'node:path';

import { AuthError, ConfigError } from '@ts-launch-blueprint/core';
import { parse, stringify } from 'smol-toml';
import { z } from 'zod';

import {
  CONFIG_FILE_NAME,
  configFile,
  ensureDir,
  isWindowsPlatform,
  projectConfigFile,
  systemConfigFiles,
} from './xdg-paths.js';

export { CONFIG_FILE_NAME };

/** Token environment variable (`TS_PROJECTS_TOKEN`). */
export const TOKEN_ENV_VAR = 'TS_PROJECTS_TOKEN' as const;

/** Config file override environment variable (`TS_PROJECTS_CONFIG`). */
export const CONFIG_PATH_ENV_VAR = 'TS_PROJECTS_CONFIG' as const;

/** Allowed `[output].format` values. */
export const CONFIG_OUTPUT_FORMATS: readonly ['text', 'json', 'csv', 'markdown'] = [
  'text',
  'json',
  'csv',
  'markdown',
] as const;

/** Allowed `[output].color` values. */
export const CONFIG_COLOR_MODES: readonly ['auto', 'always', 'never'] = [
  'auto',
  'always',
  'never',
] as const;

/** Allowed `[logging].level` and `[logging].file_level` values. */
export const CONFIG_LOG_LEVELS: readonly ['debug', 'info', 'warning', 'error', 'critical'] = [
  'debug',
  'info',
  'warning',
  'error',
  'critical',
] as const;

/** Allowed `[logging].format` values. */
export const CONFIG_LOG_FORMATS: readonly ['text', 'json'] = ['text', 'json'] as const;

/** Actionable hint when no token is configured. */
export const MISSING_TOKEN_HINT: string = `supply it via --token or $${TOKEN_ENV_VAR}; \`ts-projects doctor\` checks setup`;

export type ConfigOutputFormat = (typeof CONFIG_OUTPUT_FORMATS)[number];
export type ConfigColorMode = (typeof CONFIG_COLOR_MODES)[number];
export type ConfigLogLevel = (typeof CONFIG_LOG_LEVELS)[number];
export type ConfigLogFormat = (typeof CONFIG_LOG_FORMATS)[number];

/** Resolved `[output]` settings. */
export interface OutputSettings {
  format: ConfigOutputFormat;
  color: ConfigColorMode;
}

/** Resolved `[logging]` settings. */
export interface LoggingSettings {
  level: ConfigLogLevel;
  file: string;
  file_level: ConfigLogLevel;
  format: ConfigLogFormat;
}

/** Full validated settings object across `[output]` and `[logging]`. */
export interface ConfigSettings {
  output: OutputSettings;
  logging: LoggingSettings;
}

/** Known config sections. */
export type ConfigSection = 'output' | 'logging';

/** Parsed `section.key` reference. */
export interface ParsedConfigKey {
  section: ConfigSection;
  key: string;
}

const outputFormatSchema: z.ZodType<ConfigOutputFormat> = z.enum(CONFIG_OUTPUT_FORMATS);
const outputColorSchema: z.ZodType<ConfigColorMode> = z.enum(CONFIG_COLOR_MODES);
const logLevelSchema: z.ZodType<ConfigLogLevel> = z.enum(CONFIG_LOG_LEVELS);
const logFormatSchema: z.ZodType<ConfigLogFormat> = z.enum(CONFIG_LOG_FORMATS);
const logFileSchema: z.ZodString = z.string();

/** Zod v4 schema for partial TOML config values (`extra = 'ignore'`). */
export const configFileSchema: z.ZodObject<{
  workspace: z.ZodOptional<z.ZodString>;
  limit: z.ZodOptional<z.ZodNumber>;
  output: z.ZodOptional<
    z.ZodObject<{
      format: z.ZodOptional<typeof outputFormatSchema>;
      color: z.ZodOptional<typeof outputColorSchema>;
    }>
  >;
  logging: z.ZodOptional<
    z.ZodObject<{
      level: z.ZodOptional<typeof logLevelSchema>;
      file: z.ZodOptional<typeof logFileSchema>;
      file_level: z.ZodOptional<typeof logLevelSchema>;
      format: z.ZodOptional<typeof logFormatSchema>;
    }>
  >;
}> = z.object({
  workspace: z.string().optional(),
  limit: z.number().int().positive().optional(),
  output: z
    .object({
      format: outputFormatSchema.optional(),
      color: outputColorSchema.optional(),
    })
    .optional(),
  logging: z
    .object({
      level: logLevelSchema.optional(),
      file: logFileSchema.optional(),
      file_level: logLevelSchema.optional(),
      format: logFormatSchema.optional(),
    })
    .optional(),
});

/** Values a config file may carry (tokens are never stored in config files). */
export type ConfigFileValues = z.infer<typeof configFileSchema>;

/** Where the effective token came from (env/flag-only per ADR 0002). */
export type TokenSource = 'flag' | 'env' | 'none';

/** Effective merged configuration. */
export interface ResolvedConfig {
  token: string | undefined;
  workspace: string | undefined;
  limit: number | undefined;
  tokenSource: TokenSource;
  /** Highest-precedence loaded config file, if any. */
  configPath: string | undefined;
  /** Target config file path (explicit override or user `configFile`). */
  targetPath: string;
  /** Existing config layer paths encountered in lowest-to-highest precedence order. */
  loadedPaths: string[];
  /** Validated `[output]` and `[logging]` settings after merge and degradation. */
  settings: ConfigSettings;
  /** Dotted keys explicitly set by valid config layers. */
  setFields: ReadonlySet<string>;
  /** Non-fatal config discovery/validation warnings. */
  warnings: string[];
}

/** Minimal fs surface used by config resolution and atomic writes (`node:fs` satisfies it). */
export interface ConfigFs {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf8') => string;
  statSync: (path: string) => { mode: number };
  mkdirSync: (path: string, options: { recursive: true; mode?: number | undefined }) => unknown;
  writeFileSync: (path: string, data: string, options: { mode?: number }) => void;
  chmodSync: (path: string, mode: number) => void;
  openSync: (path: string, flags: string, mode?: number) => number;
  writeSync: (
    fd: number,
    data: string,
    position?: number | null,
    encoding?: BufferEncoding
  ) => number;
  fsyncSync: (fd: number) => void;
  closeSync: (fd: number) => void;
  renameSync: (oldPath: string, newPath: string) => void;
  unlinkSync: (path: string) => void;
}

const realFs: ConfigFs = {
  existsSync,
  readFileSync,
  statSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  openSync,
  writeSync: (fd, data, position, encoding) => writeSync(fd, data, position, encoding),
  fsyncSync,
  closeSync,
  renameSync,
  unlinkSync,
};

/** Inputs to config resolution; everything injectable for tests. */
export interface ResolveConfigOptions {
  /** --token flag value (highest precedence). */
  flagToken?: string | undefined;
  /** --config flag value; replaces discovery when non-empty. */
  configPathFlag?: string | undefined;
  env: Record<string, string | undefined>;
  homedir: () => string;
  cwd?: (() => string) | undefined;
  fs?: ConfigFs | undefined;
  /** Sink for non-fatal config degradation warnings. */
  warn?: ((message: string) => void) | undefined;
  /** Platform override for tests; defaults to `process.platform`. */
  platform?: string | undefined;
}

/** Options for writing or updating config files. */
export interface WriteConfigOptions {
  fs?: ConfigFs | undefined;
  platform?: string | undefined;
  dryRun?: boolean | undefined;
}

/** Default user config file path (discovery tier). */
export function defaultConfigPath(
  env: Record<string, string | undefined>,
  homedir: () => string,
  platform?: string
): string {
  return configFile(env, homedir, platform);
}

const WRITABLE_KEYS: readonly string[] = [
  'logging.file',
  'logging.file_level',
  'logging.format',
  'logging.level',
  'output.color',
  'output.format',
];

const GETTABLE_KEYS: readonly string[] = (() => {
  const keys = [...WRITABLE_KEYS, 'token'];
  keys.sort();
  return keys;
})();

const SECTION_KEYS: Record<ConfigSection, readonly string[]> = {
  output: ['format', 'color'],
  logging: ['level', 'file', 'file_level', 'format'],
};

/** Return sorted dotted keys allowed in `config set`. */
export function writableKeys(): string[] {
  return [...WRITABLE_KEYS];
}

/** Return sorted dotted keys allowed in `config get` (includes `token`). */
export function gettableKeys(): string[] {
  return [...GETTABLE_KEYS];
}

/** Parse and validate a dotted config key for writing (`section.key`). */
export function parseConfigKey(dottedKey: string): ParsedConfigKey {
  const parts = dottedKey.split('.');
  if (parts.length !== 2) {
    throw new ConfigError(
      `unknown config key '${dottedKey}'. Settable keys: ${WRITABLE_KEYS.join(', ')}`
    );
  }
  const [sectionRaw, key] = parts;
  if (sectionRaw !== 'output' && sectionRaw !== 'logging') {
    throw new ConfigError(
      `unknown config key '${dottedKey}'. Settable keys: ${WRITABLE_KEYS.join(', ')}`
    );
  }
  if (key === undefined || !SECTION_KEYS[sectionRaw].includes(key)) {
    throw new ConfigError(
      `unknown config key '${dottedKey}'. Settable keys: ${WRITABLE_KEYS.join(', ')}`
    );
  }
  return { section: sectionRaw, key };
}

/** Allowed discrete choices for a config key, or `undefined` for free-form strings. */
export function allowedConfigValues(
  section: ConfigSection,
  key: string
): readonly string[] | undefined {
  if (section === 'output') {
    if (key === 'format') {
      return CONFIG_OUTPUT_FORMATS;
    }
    if (key === 'color') {
      return CONFIG_COLOR_MODES;
    }
  }
  if (section === 'logging') {
    if (key === 'level' || key === 'file_level') {
      return CONFIG_LOG_LEVELS;
    }
    if (key === 'format') {
      return CONFIG_LOG_FORMATS;
    }
  }
  return undefined;
}

/** Validate and coerce a raw CLI string value for `section.key` (exact, case-sensitive). */
export function coerceConfigValue(section: ConfigSection, key: string, rawValue: string): string {
  parseConfigKey(`${section}.${key}`);
  const allowed = allowedConfigValues(section, key);
  if (allowed === undefined) {
    return rawValue;
  }
  if (!allowed.includes(rawValue)) {
    throw new ConfigError(
      `invalid value for ${section}.${key}: '${rawValue}' (allowed: ${allowed.join(', ')})`
    );
  }
  return rawValue;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
  );
}

function toPlainValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => toPlainValue(item));
  }
  if (isPlainRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      Object.defineProperty(out, k, {
        value: toPlainValue(v),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return out;
  }
  return value;
}

function toPlainRecord(value: unknown): Record<string, unknown> {
  const plain = toPlainValue(value);
  return isPlainRecord(plain) ? plain : {};
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value) ?? String(value);
}

function defaultSettings(): ConfigSettings {
  return {
    output: { format: 'text', color: 'auto' },
    logging: { level: 'warning', file: '', file_level: 'debug', format: 'text' },
  };
}

function validateSectionField<T>(
  table: Record<string, unknown>,
  section: ConfigSection,
  key: string,
  schema: z.ZodType<T>,
  allowed: readonly string[] | undefined,
  setFields: Set<string>,
  warnings: string[],
  warn: ((message: string) => void) | undefined
): T | undefined {
  if (!Object.hasOwn(table, key) || table[key] === undefined) {
    return undefined;
  }
  const raw = table[key];
  const parsed = schema.safeParse(raw);
  if (parsed.success) {
    setFields.add(`${section}.${key}`);
    return parsed.data;
  }
  const suffix = allowed !== undefined ? ` (allowed: ${allowed.join(', ')})` : '';
  const msg = `ignoring invalid config value ${section}.${key} = ${formatValue(raw)}${suffix}`;
  warnings.push(msg);
  warn?.(msg);
  return undefined;
}

function mergeLayers(
  layers: Record<string, unknown>[],
  warn: ((message: string) => void) | undefined
): {
  settings: ConfigSettings;
  setFields: Set<string>;
  warnings: string[];
  workspace: string | undefined;
  limit: number | undefined;
} {
  const outputMerged: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const loggingMerged: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  let workspaceRaw: unknown;
  let limitRaw: unknown;

  for (const layer of layers) {
    if (Object.hasOwn(layer, 'output') && isPlainRecord(layer['output'])) {
      Object.assign(outputMerged, layer['output']);
    }
    if (Object.hasOwn(layer, 'logging') && isPlainRecord(layer['logging'])) {
      Object.assign(loggingMerged, layer['logging']);
    }
    if (Object.hasOwn(layer, 'workspace') && layer['workspace'] !== undefined) {
      workspaceRaw = layer['workspace'];
    }
    if (Object.hasOwn(layer, 'limit') && layer['limit'] !== undefined) {
      limitRaw = layer['limit'];
    }
  }

  const settings = defaultSettings();
  const setFields = new Set<string>();
  const warnings: string[] = [];

  const outFormat = validateSectionField(
    outputMerged,
    'output',
    'format',
    outputFormatSchema,
    CONFIG_OUTPUT_FORMATS,
    setFields,
    warnings,
    warn
  );
  if (outFormat !== undefined) {
    settings.output.format = outFormat;
  }

  const outColor = validateSectionField(
    outputMerged,
    'output',
    'color',
    outputColorSchema,
    CONFIG_COLOR_MODES,
    setFields,
    warnings,
    warn
  );
  if (outColor !== undefined) {
    settings.output.color = outColor;
  }

  const logLevel = validateSectionField(
    loggingMerged,
    'logging',
    'level',
    logLevelSchema,
    CONFIG_LOG_LEVELS,
    setFields,
    warnings,
    warn
  );
  if (logLevel !== undefined) {
    settings.logging.level = logLevel;
  }

  const logFile = validateSectionField(
    loggingMerged,
    'logging',
    'file',
    logFileSchema,
    undefined,
    setFields,
    warnings,
    warn
  );
  if (logFile !== undefined) {
    settings.logging.file = logFile;
  }

  const logFileLevel = validateSectionField(
    loggingMerged,
    'logging',
    'file_level',
    logLevelSchema,
    CONFIG_LOG_LEVELS,
    setFields,
    warnings,
    warn
  );
  if (logFileLevel !== undefined) {
    settings.logging.file_level = logFileLevel;
  }

  const logFormat = validateSectionField(
    loggingMerged,
    'logging',
    'format',
    logFormatSchema,
    CONFIG_LOG_FORMATS,
    setFields,
    warnings,
    warn
  );
  if (logFormat !== undefined) {
    settings.logging.format = logFormat;
  }

  let workspace: string | undefined;
  if (workspaceRaw !== undefined) {
    const parsed = z.string().safeParse(workspaceRaw);
    if (parsed.success) {
      workspace = parsed.data;
    } else {
      const msg = `ignoring invalid config value workspace = ${formatValue(workspaceRaw)}`;
      warnings.push(msg);
      warn?.(msg);
    }
  }

  let limit: number | undefined;
  if (limitRaw !== undefined) {
    const parsed = z.number().int().positive().safeParse(limitRaw);
    if (parsed.success) {
      limit = parsed.data;
    } else {
      const msg = `ignoring invalid config value limit = ${formatValue(limitRaw)}`;
      warnings.push(msg);
      warn?.(msg);
    }
  }

  return { settings, setFields, warnings, workspace, limit };
}

function readDiscoveredLayer(
  path: string,
  fs: ConfigFs
): { data: Record<string, unknown>; warning: string | undefined } {
  let raw: string;
  try {
    raw = fs.readFileSync(path, 'utf8');
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { data: {}, warning: `ignoring unreadable config file ${path}: ${detail}` };
  }
  try {
    return { data: toPlainRecord(parse(raw)), warning: undefined };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { data: {}, warning: `ignoring unreadable config file ${path}: ${detail}` };
  }
}

function readExplicitLayer(path: string, fs: ConfigFs): Record<string, unknown> {
  let raw: string;
  try {
    raw = fs.readFileSync(path, 'utf8');
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`cannot read config file ${path}: ${detail}`, { cause: err });
  }
  try {
    return toPlainRecord(parse(raw));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`invalid TOML in config file ${path}: ${detail}`, { cause: err });
  }
}

/**
 * Resolve configuration across 3 layers (`system -> user -> project`) or an explicit
 * `--config` / `TS_PROJECTS_CONFIG` path, plus env/flag-only token resolution.
 */
export function resolveConfig(options: ResolveConfigOptions): ResolvedConfig {
  const fs = options.fs ?? realFs;
  const platform = options.platform ?? process.platform;
  const cwd = options.cwd ?? (() => process.cwd());

  const envConfigOverride = options.env[CONFIG_PATH_ENV_VAR];
  const explicitPath =
    options.configPathFlag !== undefined && options.configPathFlag !== ''
      ? options.configPathFlag
      : envConfigOverride !== undefined && envConfigOverride !== ''
        ? envConfigOverride
        : undefined;

  const warnings: string[] = [];
  const loadedPaths: string[] = [];
  const layers: Record<string, unknown>[] = [];
  let targetPath: string;

  if (explicitPath !== undefined) {
    targetPath = explicitPath;
    if (fs.existsSync(explicitPath)) {
      loadedPaths.push(explicitPath);
      layers.push(readExplicitLayer(explicitPath, fs));
    }
  } else {
    const userPath = configFile(options.env, options.homedir, platform);
    targetPath = userPath;
    const systemPaths = [...systemConfigFiles(options.env, platform)];
    systemPaths.reverse();
    const projectPath = projectConfigFile(cwd, (p) => fs.existsSync(p), platform);
    const layerPaths = [...systemPaths, userPath, projectPath];

    for (const layerPath of layerPaths) {
      if (!fs.existsSync(layerPath)) {
        continue;
      }
      loadedPaths.push(layerPath);
      const { data, warning } = readDiscoveredLayer(layerPath, fs);
      if (warning !== undefined) {
        warnings.push(warning);
        options.warn?.(warning);
      } else {
        layers.push(data);
      }
    }
  }

  const merged = mergeLayers(layers, options.warn);
  warnings.push(...merged.warnings);

  const envToken = options.env[TOKEN_ENV_VAR];
  let token: string | undefined;
  let tokenSource: TokenSource = 'none';
  if (options.flagToken !== undefined && options.flagToken !== '') {
    token = options.flagToken;
    tokenSource = 'flag';
  } else if (envToken !== undefined && envToken !== '') {
    token = envToken;
    tokenSource = 'env';
  }

  return {
    token,
    workspace: merged.workspace,
    limit: merged.limit,
    tokenSource,
    configPath: loadedPaths.at(-1),
    targetPath,
    loadedPaths,
    settings: merged.settings,
    setFields: merged.setFields,
    warnings,
  };
}

/**
 * Actionable two-remedy missing-token message (ADR 0002: tokens are never stored
 * in config files; includes `ts-projects doctor` hint).
 */
export function missingTokenMessage(
  _env?: Record<string, string | undefined>,
  _homedir?: () => string
): string {
  return [
    `No ${TOKEN_ENV_VAR} found (never stored in the config file).`,
    'To set your ts-projects token, you have two options:',
    '1. Use the --token option when running the command:',
    '   ts-projects --token your_token_here',
    `2. Set the ${TOKEN_ENV_VAR} environment variable:`,
    `   export ${TOKEN_ENV_VAR}=your_token_here`,
    'Run `ts-projects doctor` to check your setup.',
  ].join('\n');
}

/**
 * Enforce token presence after resolution; throws `AuthError` (`TS002`, exit 4)
 * with remediation message and structured hint.
 */
export function requireToken(
  config: ResolvedConfig,
  env: Record<string, string | undefined>,
  homedir: () => string
): string {
  if (config.token === undefined) {
    throw new AuthError(missingTokenMessage(env, homedir), {
      hint: MISSING_TOKEN_HINT,
    });
  }
  return config.token;
}

/** Mask a secret (`****` for `<=4` chars, `****XXXX` for `>4` chars). */
export function maskToken(token: string): string {
  if (token.length <= 4) {
    return '****';
  }
  return `****${token.slice(-4)}`;
}

/** Mask a secret for display (alias of `maskToken`). */
export function redactToken(token: string): string {
  return maskToken(token);
}

/** Tolerantly read a `section.key` value from a specific TOML file (`undefined` if missing/corrupt). */
export function getConfigFileValue(
  configPath: string,
  dottedKey: string,
  fs: ConfigFs = realFs
): unknown {
  const parts = dottedKey.split('.');
  if (parts.length !== 2) {
    return undefined;
  }
  const [section, key] = parts;
  if (
    section === undefined ||
    key === undefined ||
    section === '__proto__' ||
    key === '__proto__' ||
    !fs.existsSync(configPath)
  ) {
    return undefined;
  }
  try {
    const data = toPlainRecord(parse(fs.readFileSync(configPath, 'utf8')));
    if (!Object.hasOwn(data, section)) {
      return undefined;
    }
    const table = data[section];
    if (!isPlainRecord(table) || !Object.hasOwn(table, key)) {
      return undefined;
    }
    return table[key];
  } catch {
    return undefined;
  }
}

/**
 * Read an existing TOML config file prior to modification, returning `{}` if absent
 * and refusing (`ConfigError`) if the existing file is unreadable or invalid TOML.
 */
export function readConfigForWrite(
  configPath: string,
  fs: ConfigFs = realFs
): Record<string, unknown> {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return toPlainRecord(parse(raw));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new ConfigError(
      `refusing to modify ${configPath}: existing file cannot be parsed (${detail}). Fix or remove it first.`,
      { cause: err }
    );
  }
}

function serializeToml(data: Record<string, unknown>): string {
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'token' || k === '__proto__' || v === undefined) {
      continue;
    }
    if ((k === 'output' || k === 'logging') && isPlainRecord(v)) {
      const section: Record<string, unknown> = {};
      for (const [sk, sv] of Object.entries(v)) {
        if (sk === 'token' || sk === '__proto__' || sv === undefined) {
          continue;
        }
        section[sk] = sv;
      }
      sanitized[k] = section;
      continue;
    }
    sanitized[k] = v;
  }
  const rendered = stringify(sanitized);
  return rendered.endsWith('\n') ? rendered : `${rendered}\n`;
}

/**
 * Atomically write TOML config data (`openSync` temp file in target dir -> `writeSync` ->
 * `fsyncSync` -> `closeSync` -> `renameSync` -> `0o600` POSIX `chmodSync`), cleaning up any
 * temp file on failure.
 */
export function writeConfigData(
  configPath: string,
  data: Record<string, unknown>,
  options?: WriteConfigOptions
): void {
  const fs = options?.fs ?? realFs;
  const platform = options?.platform ?? process.platform;
  const isWin = isWindowsPlatform(platform);
  const p = isWin ? win32 : posix;
  const dir = p.dirname(configPath);
  const base = p.basename(configPath);

  ensureDir(dir, (dirPath, opts) => fs.mkdirSync(dirPath, opts), platform);

  const serialized = serializeToml(data);
  const tmpPath = p.join(dir, `.${base}.${process.pid}.${randomUUID()}.tmp`);

  try {
    const fd = isWin ? fs.openSync(tmpPath, 'wx') : fs.openSync(tmpPath, 'wx', 0o600);
    try {
      fs.writeSync(fd, serialized, null, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmpPath, configPath);
    if (!isWin) {
      fs.chmodSync(configPath, 0o600);
    }
  } catch (err) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // Best-effort cleanup of temp file.
    }
    throw err;
  }
}

/**
 * Validate and set a single dotted config key in `configPath` atomically, refusing
 * to modify corrupt existing files. Returns the coerced value.
 */
export function setConfigValue(
  configPath: string,
  dottedKey: string,
  rawValue: string,
  options?: WriteConfigOptions
): string {
  const { section, key } = parseConfigKey(dottedKey);
  const value = coerceConfigValue(section, key, rawValue);
  const fs = options?.fs ?? realFs;
  const data = readConfigForWrite(configPath, fs);

  if (options?.dryRun === true) {
    return value;
  }

  const sectionTable = isPlainRecord(data[section]) ? { ...data[section] } : {};
  sectionTable[key] = value;
  data[section] = sectionTable;
  writeConfigData(configPath, data, options);
  return value;
}

/**
 * Render and optionally write initial configuration settings to `configPath`, refusing
 * to overwrite a corrupt existing file. Returns the rendered TOML string.
 */
export function initConfigValues(
  configPath: string,
  values: Record<string, unknown>,
  options?: WriteConfigOptions
): string {
  const fs = options?.fs ?? realFs;
  readConfigForWrite(configPath, fs);
  const rendered = serializeToml(values);
  if (options?.dryRun !== true) {
    writeConfigData(configPath, values, options);
  }
  return rendered;
}

/**
 * Write user config atomically (`0o600` POSIX, profile ACLs on Windows), refusing
 * to overwrite a corrupt existing target. Returns the path written.
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
  const target = configFile(options.env, options.homedir, platform);
  readConfigForWrite(target, fs);
  writeConfigData(target, values as Record<string, unknown>, { fs, platform });
  return target;
}
