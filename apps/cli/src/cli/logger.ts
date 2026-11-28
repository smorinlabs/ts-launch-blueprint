// Dual-sink stderr + optional rotating file logger (ADR 0015).
// Harmonized with config `[logging]` vocabulary:
//   levels: debug | info | warning | error | critical (default: warning)
//   file sink: rotating 10MB x 5 backups, text (no ANSI) or json (JSONL),
//   key-based redaction of sensitive fields across both sinks.
import { appendFileSync, closeSync, mkdirSync, openSync, renameSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

import { ConfigError } from '@ts-launch-blueprint/core';

import type { Colors } from './colors.js';
import {
  CONFIG_LOG_FORMATS,
  CONFIG_LOG_LEVELS,
  type ConfigLogFormat,
  type ConfigLogLevel,
} from './config.js';
import { UsageError } from './exit-codes.js';
import { ensureDir, isWindowsPlatform, logFile, TOOL_DIR_NAME } from './xdg-paths.js';

/** Harmonized log levels matching `[logging].level` and `[logging].file_level`. */
export type LogLevel = ConfigLogLevel;

/** File sink format (`text` or `json`). */
export type LogFormat = ConfigLogFormat;

/** Allowed log levels in increasing severity order. */
export const LOG_LEVELS: readonly ['debug', 'info', 'warning', 'error', 'critical'] =
  CONFIG_LOG_LEVELS;

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
  critical: 4,
};

const ROTATE_MAX_BYTES = 10 * 1024 * 1024;
const ROTATE_BACKUP_COUNT = 5;
const REDACTED = '[REDACTED]';

const ENV_PREFIX = TOOL_DIR_NAME.toUpperCase().replaceAll('-', '_');
export const LOG_LEVEL_ENV_VAR: string = `${ENV_PREFIX}_LOG_LEVEL`;
export const LOG_FILE_ENV_VAR: string = `${ENV_PREFIX}_LOG_FILE`;
export const LOG_FORMAT_ENV_VAR: string = `${ENV_PREFIX}_LOG_FORMAT`;

const SENSITIVE_KEY_PARTS: readonly string[] = [
  'token',
  'password',
  'secret',
  'authorization',
  'api_key',
  'apikey',
  'credential',
  'cookie',
];

/** Redact values for keys whose lowercased name contains a sensitive marker. */
export function redactLogFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    const lowered = key.toLowerCase();
    const sensitive = SENSITIVE_KEY_PARTS.some((part) => lowered.includes(part));
    Object.defineProperty(out, key, {
      value: sensitive ? REDACTED : value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

/** Verbosity flags gathered from global CLI options. */
export interface VerbosityFlags {
  verbose: number;
  quiet: boolean;
  debug: boolean;
}

/** Resolve console log level from verbosity flags alone. */
export function resolveLevel(flags: VerbosityFlags): LogLevel {
  if (flags.debug) {
    return 'debug';
  }
  if (flags.quiet) {
    return 'error';
  }
  if (flags.verbose >= 2) {
    return 'debug';
  }
  if (flags.verbose === 1) {
    return 'info';
  }
  return 'warning';
}

function parseLogLevel(raw: string, source: string): LogLevel {
  if ((LOG_LEVELS as readonly string[]).includes(raw)) {
    return raw as LogLevel;
  }
  throw new UsageError(`Invalid ${source} "${raw}": expected one of ${LOG_LEVELS.join(', ')}`);
}

/**
 * Resolve console log level:
 * `--log-level` > `TS_PROJECTS_LOG_LEVEL` > `--debug` > `-q` > `-vv`/`-v` > `[logging].level`.
 */
export function resolveConsoleLevel(input: {
  logLevelFlag?: string | undefined;
  env: Record<string, string | undefined>;
  verbose: number;
  quiet: boolean;
  debug: boolean;
  configLevel: LogLevel;
}): LogLevel {
  if (input.logLevelFlag !== undefined && input.logLevelFlag !== '') {
    return parseLogLevel(input.logLevelFlag, '--log-level');
  }
  const envRaw = input.env[LOG_LEVEL_ENV_VAR];
  if (envRaw !== undefined && envRaw !== '') {
    return parseLogLevel(envRaw, LOG_LEVEL_ENV_VAR);
  }
  if (input.debug) {
    return 'debug';
  }
  if (input.quiet) {
    return 'error';
  }
  if (input.verbose >= 2) {
    return 'debug';
  }
  if (input.verbose === 1) {
    return 'info';
  }
  return input.configLevel;
}

function expandHome(rawPath: string, homedir: () => string, platform?: string): string {
  if (rawPath === '~') {
    return homedir();
  }
  if (rawPath.startsWith('~/') || (isWindowsPlatform(platform) && rawPath.startsWith('~\\'))) {
    const sep = isWindowsPlatform(platform) ? '\\' : '/';
    return `${homedir()}${sep}${rawPath.slice(2)}`;
  }
  return rawPath;
}

/**
 * Resolve optional file sink path:
 * `--log-file <path>` > bare `--log-file` (`logFile()`) > `TS_PROJECTS_LOG_FILE=""` (`logFile()`)
 * > `TS_PROJECTS_LOG_FILE=<path>` > `[logging].file` > off (`undefined`).
 */
export function resolveLogFilePath(input: {
  logFileFlag?: string | boolean | undefined;
  env: Record<string, string | undefined>;
  homedir: () => string;
  platform?: string | undefined;
  configFile: string;
}): string | undefined {
  if (input.logFileFlag === true) {
    return logFile(input.env, input.homedir, input.platform);
  }
  if (typeof input.logFileFlag === 'string' && input.logFileFlag !== '') {
    return expandHome(input.logFileFlag, input.homedir, input.platform);
  }
  const envVal = input.env[LOG_FILE_ENV_VAR];
  if (Object.hasOwn(input.env, LOG_FILE_ENV_VAR) && envVal !== undefined) {
    if (envVal === '') {
      return logFile(input.env, input.homedir, input.platform);
    }
    return expandHome(envVal, input.homedir, input.platform);
  }
  if (input.configFile !== '') {
    return expandHome(input.configFile, input.homedir, input.platform);
  }
  return undefined;
}

/** Resolve file sink format: `TS_PROJECTS_LOG_FORMAT` (case-insensitive) > `[logging].format`. */
export function resolveLogFormat(
  env: Record<string, string | undefined>,
  configFormat: LogFormat
): LogFormat {
  const raw = env[LOG_FORMAT_ENV_VAR];
  if (raw === undefined || raw === '') {
    return configFormat;
  }
  const normalized = raw.trim().toLowerCase();
  if (!(CONFIG_LOG_FORMATS as readonly string[]).includes(normalized)) {
    throw new ConfigError(
      `invalid ${LOG_FORMAT_ENV_VAR}: '${raw}' (allowed: ${CONFIG_LOG_FORMATS.join(', ')})`
    );
  }
  return normalized as LogFormat;
}

function rotateIfNeeded(targetPath: string): void {
  try {
    const size = statSync(targetPath).size;
    if (size < ROTATE_MAX_BYTES) {
      return;
    }
    for (let i = ROTATE_BACKUP_COUNT - 1; i >= 1; i -= 1) {
      const src = `${targetPath}.${i}`;
      const dst = `${targetPath}.${i + 1}`;
      try {
        renameSync(src, dst);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err;
        }
      }
    }
    renameSync(targetPath, `${targetPath}.1`);
  } catch {
    // Best-effort rotation.
  }
}

function formatTextLine(
  level: LogLevel,
  message: string,
  fields?: Record<string, unknown>,
  timestamp?: string
): string {
  const safeFields = fields !== undefined ? redactLogFields(fields) : undefined;
  const extras =
    safeFields !== undefined
      ? Object.entries(safeFields)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join(' ')
      : '';
  const prefix = timestamp !== undefined ? `${timestamp} [${level}] ` : '';
  const suffix = extras !== '' ? ` ${extras}` : '';
  return `${prefix}${message}${suffix}`;
}

/** Leveled dual-sink logger. */
export interface Logger {
  readonly level: LogLevel;
  readonly filePath: string | undefined;
  error: (message: string, fields?: Record<string, unknown>) => void;
  warn: (message: string, fields?: Record<string, unknown>) => void;
  info: (message: string, fields?: Record<string, unknown>) => void;
  debug: (message: string, fields?: Record<string, unknown>) => void;
  critical: (message: string, fields?: Record<string, unknown>) => void;
}

/** Options for constructing the dual-sink logger. */
export interface CreateLoggerOptions {
  stderr: (text: string) => void;
  level: LogLevel;
  colors: Colors;
  stderrIsTTY?: boolean | undefined;
  filePath?: string | undefined;
  fileLevel?: LogLevel | undefined;
  fileFormat?: LogFormat | undefined;
  platform?: string | undefined;
}

/** Build a dual-sink logger over an injected stderr writer and optional rotating file sink. */
export function createLogger(options: CreateLoggerOptions): Logger {
  const consoleMax = LEVEL_RANK[options.level];
  const fileLevel = options.fileLevel ?? 'debug';
  const fileMax = LEVEL_RANK[fileLevel];
  const fileFormat = options.fileFormat ?? 'text';
  const filePath = options.filePath;

  if (filePath !== undefined) {
    ensureDir(dirname(filePath), mkdirSync, options.platform);
    try {
      closeSync(openSync(filePath, 'wx', 0o600));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err;
      }
    }
  }

  const writeFileSink = (
    level: LogLevel,
    message: string,
    fields?: Record<string, unknown>
  ): void => {
    if (filePath === undefined || LEVEL_RANK[level] < fileMax) {
      return;
    }
    const timestamp = new Date().toISOString();
    const safeFields = fields !== undefined ? redactLogFields(fields) : {};
    rotateIfNeeded(filePath);
    if (fileFormat === 'json') {
      const record = {
        timestamp,
        level,
        logger: TOOL_DIR_NAME,
        event: message,
        ...safeFields,
      };
      appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
      return;
    }
    appendFileSync(filePath, `${formatTextLine(level, message, safeFields, timestamp)}\n`, 'utf8');
  };

  const emitConsole = (
    level: LogLevel,
    message: string,
    fields?: Record<string, unknown>
  ): void => {
    if (LEVEL_RANK[level] < consoleMax) {
      return;
    }
    const line = formatTextLine(level, message, fields);
    if (level === 'error' || level === 'critical') {
      options.stderr(`${options.colors.error(`Error: ${line}`)}\n`);
    } else if (level === 'warning') {
      options.stderr(`${options.colors.warn(`Warning: ${line}`)}\n`);
    } else if (level === 'debug') {
      options.stderr(`${options.colors.dim(`debug: ${line}`)}\n`);
    } else {
      options.stderr(`${line}\n`);
    }
  };

  const log = (level: LogLevel, message: string, fields?: Record<string, unknown>): void => {
    emitConsole(level, message, fields);
    writeFileSink(level, message, fields);
  };

  return {
    level: options.level,
    filePath,
    debug: (message, fields) => log('debug', message, fields),
    info: (message, fields) => log('info', message, fields),
    warn: (message, fields) => log('warning', message, fields),
    error: (message, fields) => log('error', message, fields),
    critical: (message, fields) => log('critical', message, fields),
  };
}
