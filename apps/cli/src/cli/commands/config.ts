// `ts-projects config` noun group: `init`, `path`, `get <key>`, `set <key> <value>`.
import { existsSync } from 'node:fs';
import { posix, win32 } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Argument, type Command } from 'commander';
import { ConfigError } from 'ts-launch-blueprint-core';

import { realChoicePrompter, realConfirmPrompter } from '../adapters.js';
import {
  allowedConfigValues,
  coerceConfigValue,
  type ConfigSection,
  type ConfigSettings,
  gettableKeys,
  maskToken,
  parseConfigKey,
  readConfigForWrite,
  TOKEN_ENV_VAR,
  writeConfigData,
} from '../config.js';
import type { CliContext, CliDeps } from '../deps.js';
import { EXIT_CODES, type ExitCode } from '../exit-codes.js';
import { type CliTableResult, richLink } from '../format.js';
import { deliverResult } from '../pager.js';
import { isWindowsPlatform } from '../xdg-paths.js';

const INIT_KEYS: readonly string[] = ['output.format', 'output.color', 'logging.level'];

/** Sentinel error to abort with a specific exit code after printing a plain stderr message. */
export class SilentExitError extends Error {
  readonly exitCode: ExitCode;

  constructor(exitCode: ExitCode, message: string = '') {
    super(message);
    this.name = 'SilentExitError';
    this.exitCode = exitCode;
  }
}

interface MutationOptions {
  dryRun: boolean;
  yes: boolean;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
  );
}

function getSettingValue(settings: ConfigSettings, section: ConfigSection, key: string): string {
  if (section === 'output') {
    const out = settings.output;
    if (key === 'format') return out.format;
    return out.color;
  }
  const log = settings.logging;
  if (key === 'level') return log.level;
  if (key === 'file') return log.file;
  if (key === 'file_level') return log.file_level;
  return log.format;
}

function configPathResult(path: string, exists: boolean, platform?: string): CliTableResult {
  const pathMod = isWindowsPlatform(platform) ? win32 : posix;
  return {
    tableColumns: () => ['Config path', 'Exists'],
    tableRows: () => [[path, exists ? 'yes' : 'no']],
    tableRowsRich: () => {
      if (!pathMod.isAbsolute(path)) {
        return [[path, exists ? 'yes' : 'no']];
      }
      try {
        const uri = pathToFileURL(path).href;
        return [[richLink(path, uri, true), exists ? 'yes' : 'no']];
      } catch {
        return [[path, exists ? 'yes' : 'no']];
      }
    },
    toJson: () => ({ path, exists }),
  };
}

function configValueResult(
  key: string,
  value: string | null,
  source: string | null
): CliTableResult {
  return {
    tableColumns: () => ['Key', 'Value', 'Source'],
    tableRows: () => [[key, value ?? '', source ?? '-']],
    toJson: () => ({ key, value, source }),
  };
}

/** Register the `config` noun group (`init`, `path`, `get`, `set`). */
export function registerConfigCommand(
  program: Command,
  deps: CliDeps,
  initContext: (commandPath: string) => CliContext
): void {
  const configGroup = program.command('config').description('inspect and edit CLI configuration');

  configGroup
    .command('init')
    .description('create or update the config file with guided prompts')
    .option('--dry-run', 'show what would change; write nothing', false)
    .option('-y, --yes', 'accept current defaults without prompting', false)
    .action(async (cmdOpts: MutationOptions) => {
      await runConfigInit(cmdOpts, deps, initContext('config init'));
    });

  configGroup
    .command('path')
    .description('show the resolved config file path and whether it exists')
    .action(() => {
      const ctx = initContext('config path');
      const target = ctx.resolvedConfig.targetPath;
      const fsExists = deps.fs?.existsSync ?? existsSync;
      deliverResult(configPathResult(target, fsExists(target), deps.platform), ctx, deps);
    });

  configGroup
    .command('get')
    .description('show a resolved config value and its source')
    .addArgument(new Argument('<key>', 'dotted config key').choices(gettableKeys()))
    .action((key: string) => {
      const ctx = initContext('config get');
      const resolved = ctx.resolvedConfig;
      if (key === 'token') {
        const value = resolved.token !== undefined ? maskToken(resolved.token) : null;
        const source = resolved.tokenSource === 'none' ? null : resolved.tokenSource;
        deliverResult(configValueResult(key, value, source), ctx, deps);
        return;
      }
      const { section, key: field } = parseConfigKey(key);
      const value = getSettingValue(resolved.settings, section, field);
      const source = resolved.setFields.has(key) ? 'config' : 'default';
      deliverResult(configValueResult(key, value, source), ctx, deps);
    });

  configGroup
    .command('set')
    .description('write a non-secret config value atomically')
    .argument('<key>', 'dotted config key (e.g. output.color, logging.level)')
    .argument('<value>', 'value to write')
    .option('--dry-run', 'show what would change; write nothing', false)
    .option('-y, --yes', 'skip overwrite confirmation prompt', false)
    .action(async (key: string, value: string, cmdOpts: MutationOptions) => {
      await runConfigSet(key, value, cmdOpts, deps, initContext('config set'));
    });
}

async function runConfigInit(
  cmdOpts: MutationOptions,
  deps: CliDeps,
  ctx: CliContext
): Promise<void> {
  const path = ctx.resolvedConfig.targetPath;
  const fsExists = deps.fs?.existsSync ?? existsSync;
  const current: Record<string, string> = {};
  for (const dotted of INIT_KEYS) {
    const { section, key } = parseConfigKey(dotted);
    current[dotted] = getSettingValue(ctx.resolvedConfig.settings, section, key);
  }

  const chosen: Record<string, string> = {};
  if (cmdOpts.yes) {
    Object.assign(chosen, current);
  } else if (ctx.opts.input === false) {
    throw new ConfigError('config init cannot prompt (--no-input set)', {
      hint: 'pass --yes to write the current defaults non-interactively',
    });
  } else {
    const promptChoice = deps.promptChoice ?? realChoicePrompter;
    for (const dotted of INIT_KEYS) {
      const { section, key } = parseConfigKey(dotted);
      const choices = allowedConfigValues(section, key) ?? [];
      const def = current[dotted] ?? '';
      const raw = await promptChoice(dotted, choices, def);
      chosen[dotted] = coerceConfigValue(section, key, raw);
    }
  }

  if (cmdOpts.dryRun) {
    for (const dotted of INIT_KEYS) {
      ctx.message(`[dry-run] would set ${dotted} = ${chosen[dotted]} in ${path}`);
    }
    deliverResult(configPathResult(path, fsExists(path), deps.platform), ctx, deps);
    return;
  }

  const data = readConfigForWrite(path, deps.fs);
  for (const dotted of INIT_KEYS) {
    const { section, key } = parseConfigKey(dotted);
    const existingSection = data[section];
    const table: Record<string, unknown> = isPlainRecord(existingSection)
      ? { ...existingSection }
      : {};
    table[key] = coerceConfigValue(section, key, chosen[dotted] ?? '');
    data[section] = table;
  }
  writeConfigData(path, data, { fs: deps.fs, platform: deps.platform });
  ctx.message(`Wrote ${path}`);
  deliverResult(configPathResult(path, true, deps.platform), ctx, deps);
}

async function runConfigSet(
  key: string,
  value: string,
  cmdOpts: MutationOptions,
  deps: CliDeps,
  ctx: CliContext
): Promise<void> {
  if (key === 'token') {
    throw new ConfigError("cannot set 'token' in config file (tokens are never stored in TOML)", {
      hint: `supply it via --token or $${TOKEN_ENV_VAR}`,
    });
  }
  const { section, key: field } = parseConfigKey(key);
  const coerced = coerceConfigValue(section, field, value);
  const path = ctx.resolvedConfig.targetPath;

  if (cmdOpts.dryRun) {
    ctx.message(`[dry-run] would set ${key} = ${coerced} in ${path}`);
    deliverResult(configValueResult(key, coerced, 'dry-run'), ctx, deps);
    return;
  }

  const data = readConfigForWrite(path, deps.fs);
  const existingSection = data[section];
  const table: Record<string, unknown> = isPlainRecord(existingSection)
    ? { ...existingSection }
    : {};
  const existing = table[field];

  if (existing !== undefined && existing !== coerced && !cmdOpts.yes) {
    const promptMsg = `Overwrite ${key} (${String(existing)} → ${coerced}) in ${path}?`;
    if (ctx.opts.input === false) {
      throw new ConfigError(`refusing to proceed without confirmation (--no-input): ${promptMsg}`, {
        hint: 'pass --yes to confirm non-interactively',
      });
    }
    const promptConfirm = deps.promptConfirm ?? realConfirmPrompter;
    const confirmed = await promptConfirm(promptMsg, false);
    if (!confirmed) {
      deps.stderr('Aborted.\n');
      throw new SilentExitError(EXIT_CODES.sigint, 'Aborted.');
    }
  }

  table[field] = coerced;
  data[section] = table;
  writeConfigData(path, data, { fs: deps.fs, platform: deps.platform });
  ctx.message(`Set ${key} = ${coerced} in ${path}`);
  deliverResult(configValueResult(key, coerced, 'file'), ctx, deps);
}
