// Environment/setup diagnostics for `ts-projects doctor [--bundle]` (ADR 0012).
// Pure collection & redaction logic; never prints or reads log file contents.
import { existsSync } from 'node:fs';
import { release as osRelease } from 'node:os';

import { VERSION } from '../version.js';
import { type ConfigSettings, TOKEN_ENV_VAR, type ResolvedConfig } from './config.js';
import type { CliDeps } from './deps.js';
import type { CliTableResult } from './format.js';
import { logFile, TOOL_DIR_NAME } from './xdg-paths.js';

const MIN_NODE_MAJOR = 24;
const SENSITIVE_ENV_MARKERS: readonly string[] = [
  'TOKEN',
  'SECRET',
  'KEY',
  'PASSWORD',
  'CRED',
  'PRIVATE',
];

const ENV_PREFIX = `${TOOL_DIR_NAME.toUpperCase().replaceAll('-', '_')}_`;

/** Status of a single diagnostic check. */
export type CheckStatus = 'ok' | 'warn' | 'error';

/** One diagnostic check item. */
export interface DoctorCheck {
  name: string;
  status: CheckStatus;
  detail: string;
}

/** Aggregated diagnostic report rendered by `doctor`. */
export interface DoctorReport extends CliTableResult {
  readonly checks: DoctorCheck[];
  readonly hasError: () => boolean;
}

/** Redacted environment snapshot rendered by `doctor --bundle`. */
export interface DiagnosticsBundle extends CliTableResult {
  readonly version: string;
  readonly node: string;
  readonly platform: string;
  readonly checks: DoctorCheck[];
  readonly settings: ConfigSettings;
  readonly config_path: string;
  readonly config_exists: boolean;
  readonly loaded_paths: string[];
  readonly token_present: boolean;
  readonly token_source: 'flag' | 'env' | null;
  readonly env: Record<string, string>;
  readonly log_file: string;
  readonly hasError: () => boolean;
}

/** Collect runtime and configuration checks for `doctor`. */
export function runDiagnostics(
  resolved: ResolvedConfig,
  deps: Pick<CliDeps, 'platform' | 'fs' | 'nodeVersion' | 'osRelease'>
): DoctorReport {
  const nodeVersion = deps.nodeVersion ?? process.versions.node;
  const major = Number.parseInt(nodeVersion.split('.')[0] ?? '0', 10);
  const nodeOk = Number.isFinite(major) && major >= MIN_NODE_MAJOR;

  const platformName = deps.platform ?? process.platform;
  const platformDetail = `${platformName}-${process.arch} (${deps.osRelease ?? osRelease()})`;

  const cfgPath = resolved.targetPath;
  const fsExists = deps.fs?.existsSync ?? existsSync;
  const found = fsExists(cfgPath);

  const checks: DoctorCheck[] = [
    {
      name: 'node',
      status: nodeOk ? 'ok' : 'error',
      detail: nodeOk ? nodeVersion : `${nodeVersion} (< ${MIN_NODE_MAJOR} required)`,
    },
    {
      name: 'platform',
      status: 'ok',
      detail: platformDetail,
    },
    {
      name: 'config-file',
      status: found ? 'ok' : 'warn',
      detail: `${cfgPath} (${found ? 'found' : 'not found'})`,
    },
    resolved.token !== undefined
      ? {
          name: 'token',
          status: 'ok',
          detail: `present (source: ${resolved.tokenSource})`,
        }
      : {
          name: 'token',
          status: 'warn',
          detail: `not set (supply via --token or $${TOKEN_ENV_VAR}; never stored in config)`,
        },
  ];

  return {
    checks,
    hasError: () => checks.some((c) => c.status === 'error'),
    tableTitle: 'Diagnostics',
    tableColumns: () => ['Check', 'Status', 'Detail'],
    tableRows: () => checks.map((c) => [c.name, c.status, c.detail]),
    toJson: () => ({ checks }),
  };
}

function redactAppEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  const keys = Object.keys(env);
  keys.sort();
  for (const key of keys) {
    if (!key.startsWith(ENV_PREFIX)) {
      continue;
    }
    const raw = env[key];
    if (raw === undefined) {
      continue;
    }
    const sensitive = SENSITIVE_ENV_MARKERS.some((marker) => key.includes(marker));
    Object.defineProperty(out, key, {
      value: sensitive ? '<redacted>' : raw,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

/** Collect a redacted diagnostics snapshot for `doctor --bundle` (never reads log contents). */
export function buildDiagnosticsBundle(
  resolved: ResolvedConfig,
  deps: Pick<CliDeps, 'env' | 'homedir' | 'platform' | 'fs' | 'nodeVersion' | 'osRelease'>,
  report?: DoctorReport
): DiagnosticsBundle {
  const effectiveReport = report ?? runDiagnostics(resolved, deps);
  const nodeVersion = deps.nodeVersion ?? process.versions.node;
  const platformName = deps.platform ?? process.platform;
  const platformDetail = `${platformName}-${process.arch} (${deps.osRelease ?? osRelease()})`;
  const cfgPath = resolved.targetPath;
  const fsExists = deps.fs?.existsSync ?? existsSync;
  const configExists = fsExists(cfgPath);
  const tokenSource: 'flag' | 'env' | null =
    resolved.tokenSource === 'none' ? null : resolved.tokenSource;
  const redactedEnv = redactAppEnv(deps.env);
  const defaultLogPath = logFile(deps.env, deps.homedir, deps.platform);

  const payload = {
    version: VERSION,
    node: nodeVersion,
    platform: platformDetail,
    checks: effectiveReport.checks,
    settings: resolved.settings,
    config_path: cfgPath,
    config_exists: configExists,
    loaded_paths: [...resolved.loadedPaths],
    token_present: resolved.token !== undefined,
    token_source: tokenSource,
    env: redactedEnv,
    log_file: defaultLogPath,
  };

  return {
    ...payload,
    hasError: effectiveReport.hasError,
    tableTitle: 'Diagnostics bundle',
    tableColumns: () => ['Field', 'Value'],
    tableRows: () => {
      const okCount = effectiveReport.checks.filter((c) => c.status === 'ok').length;
      const warnCount = effectiveReport.checks.filter((c) => c.status === 'warn').length;
      const errCount = effectiveReport.checks.filter((c) => c.status === 'error').length;
      const tokenLabel = payload.token_present ? `present (${payload.token_source})` : 'absent';
      const envKeys = Object.keys(payload.env);
      envKeys.sort();
      return [
        ['version', payload.version],
        ['node', payload.node],
        ['platform', payload.platform],
        ['checks', `${okCount} ok / ${warnCount} warn / ${errCount} error`],
        ['config path', payload.config_path],
        ['config exists', payload.config_exists ? 'yes' : 'no'],
        ['loaded configs', payload.loaded_paths.join(', ') || '-'],
        ['token', tokenLabel],
        ['env', envKeys.join(', ') || '-'],
        ['log file', payload.log_file],
      ];
    },
    toJson: () => payload,
  };
}
