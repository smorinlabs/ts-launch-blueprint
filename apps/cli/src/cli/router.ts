// Commander v15 noun-verb program factory wrapped in DI (`runCli(argv, deps)`).
// Uses HelpGroupCommand so bare root / noun groups emit help to stdout and exit 0
// while preserving showSuggestionAfterError(true) on typos.
import { homedir as osHomedir } from 'node:os';

import { Command, CommanderError, type HelpContext, Option } from 'commander';
import { DomainError, ERROR_CODES } from 'ts-launch-blueprint-core';

import { VERSION } from '../version.js';
import {
  realChoicePrompter,
  realClipboard,
  realConfirmPrompter,
  realPager,
  realPrompter,
  realSpinner,
} from './adapters.js';
import { colorEnabled, type Colors, createColors } from './colors.js';
import { registerCompletionCommand } from './commands/completion.js';
import { registerConfigCommand, SilentExitError } from './commands/config.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerProjectsCommand } from './commands/projects.js';
import { type ConfigColorMode, resolveConfig } from './config.js';
import { writeCrashLog } from './crash-log.js';
import type { CliContext, CliDeps, GlobalOpts } from './deps.js';
import { CliError, EXIT_CODES, exitCodeFor, UsageError } from './exit-codes.js';
import { formatHumanError, formatJsonError, OUTPUT_FORMATS, type OutputFormat } from './format.js';
import {
  createLogger,
  LOG_LEVELS,
  resolveConsoleLevel,
  resolveLogFilePath,
  resolveLogFormat,
} from './logger.js';
import { maybeShowFirstRunHint } from './onboarding.js';
import { TOOL_DIR_NAME } from './xdg-paths.js';

const ENV_PREFIX = TOOL_DIR_NAME.toUpperCase().replaceAll('-', '_');
const OUTPUT_ENV_VAR = `${ENV_PREFIX}_OUTPUT`;

/** Command subclass converting bare-group `error: true` help calls to exit 0 on stdout. */
class HelpGroupCommand extends Command {
  override createCommand(name?: string): Command {
    return new HelpGroupCommand(name);
  }

  override help(context?: HelpContext): never;
  override help(cb: (str: string) => string): never;
  override help(contextOrCb?: HelpContext | ((str: string) => string)): never {
    if (typeof contextOrCb === 'function') {
      return super.help(contextOrCb);
    }
    if (contextOrCb?.error === true) {
      return super.help({ ...contextOrCb, error: false });
    }
    return super.help(contextOrCb);
  }
}

/** Real process-backed deps for the production entry point. */
export function realDeps(): CliDeps {
  return {
    stdout: (text) => {
      process.stdout.write(text);
    },
    stderr: (text) => {
      process.stderr.write(text);
    },
    env: process.env,
    homedir: osHomedir,
    cwd: () => process.cwd(),
    platform: process.platform,
    stdoutIsTTY: process.stdout.isTTY ?? false,
    stderrIsTTY: process.stderr.isTTY ?? false,
    stdinIsTTY: process.stdin.isTTY ?? false,
    fetchImpl: globalThis.fetch,
    prompter: realPrompter,
    promptChoice: realChoicePrompter,
    promptConfirm: realConfirmPrompter,
    pager: realPager,
    clipboard: realClipboard,
    spinner: realSpinner,
  };
}

function resolveOutputMode(
  opts: GlobalOpts,
  env: Record<string, string | undefined>,
  configFormat: OutputFormat
): OutputFormat {
  if (opts.json === true) {
    return 'json';
  }
  if (opts.output !== undefined) {
    return opts.output;
  }
  const rawEnv = env[OUTPUT_ENV_VAR];
  if (rawEnv !== undefined && rawEnv !== '') {
    if (!(OUTPUT_FORMATS as readonly string[]).includes(rawEnv)) {
      throw new UsageError(
        `Invalid ${OUTPUT_ENV_VAR} "${rawEnv}": expected one of ${OUTPUT_FORMATS.join(', ')}`
      );
    }
    return rawEnv as OutputFormat;
  }
  return configFormat;
}

function resolveColorMode(
  opts: GlobalOpts,
  env: Record<string, string | undefined>,
  configColor: ConfigColorMode
): ConfigColorMode {
  if (opts.color === false) {
    return 'never';
  }
  const noColor = env['NO_COLOR'];
  if (noColor !== undefined && noColor !== '') {
    return 'never';
  }
  const forceColor = env['FORCE_COLOR'];
  if (forceColor !== undefined && forceColor !== '' && forceColor !== '0') {
    return 'always';
  }
  return configColor;
}

function fallbackIsJson(program: Command, deps: CliDeps): boolean {
  const opts = program.opts<GlobalOpts>();
  if (opts.json === true || opts.output === 'json') {
    return true;
  }
  return opts.output === undefined && deps.env[OUTPUT_ENV_VAR] === 'json';
}

function fallbackColors(program: Command, deps: CliDeps): Colors {
  const opts = program.opts<GlobalOpts>();
  return createColors(
    colorEnabled({
      noColorFlag: opts.color === false,
      env: deps.env,
      isTTY: deps.stderrIsTTY,
    })
  );
}

interface ContextRef {
  current: CliContext | undefined;
  outputMode: OutputFormat | undefined;
  colors: Colors | undefined;
}

function buildContext(
  program: Command,
  deps: CliDeps,
  commandPath: string,
  ctxRef: ContextRef
): CliContext {
  const opts = program.opts<GlobalOpts>();

  // Validate TS_PROJECTS_OUTPUT / --output early so invalid values throw UsageError (2).
  const initialMode = resolveOutputMode(opts, deps.env, 'text');
  ctxRef.outputMode = initialMode;

  const resolvedConfig = resolveConfig({
    flagToken: opts.token,
    configPathFlag: opts.config,
    env: deps.env,
    homedir: deps.homedir,
    cwd: deps.cwd,
    fs: deps.fs,
    platform: deps.platform,
  });

  const outputMode = resolveOutputMode(opts, deps.env, resolvedConfig.settings.output.format);
  ctxRef.outputMode = outputMode;

  const colorMode = resolveColorMode(opts, deps.env, resolvedConfig.settings.output.color);
  const stderrColored =
    colorMode === 'always' ? true : colorMode === 'never' ? false : deps.stderrIsTTY;
  const colors = createColors(stderrColored);
  ctxRef.colors = colors;

  const message = (text: string): void => {
    if (outputMode === 'json') {
      return;
    }
    deps.stderr(`${text}\n`);
  };

  // Emit discovered-config degradation warnings ONCE on stderr (suppressed in json mode).
  for (const warning of resolvedConfig.warnings) {
    message(`${colors.warn('warning:')} ${warning}`);
  }

  const level = resolveConsoleLevel({
    logLevelFlag: opts.logLevel,
    env: deps.env,
    verbose: opts.verbose,
    quiet: opts.quiet,
    debug: opts.debug,
    configLevel: resolvedConfig.settings.logging.level,
  });
  const filePath = resolveLogFilePath({
    logFileFlag: opts.logFile,
    env: deps.env,
    homedir: deps.homedir,
    platform: deps.platform,
    configFile: resolvedConfig.settings.logging.file,
  });
  const fileFormat = resolveLogFormat(deps.env, resolvedConfig.settings.logging.format);

  const logger = createLogger({
    stderr: deps.stderr,
    level,
    colors,
    stderrIsTTY: deps.stderrIsTTY,
    filePath,
    fileLevel: resolvedConfig.settings.logging.file_level,
    fileFormat,
    platform: deps.platform,
  });

  logger.debug('invocation context ready', {
    output_mode: outputMode,
    color: colorMode,
    log_file: filePath ?? null,
  });

  const ctx: CliContext = {
    opts,
    colors,
    logger,
    outputMode,
    colorMode,
    outputFile: opts.outputFile,
    resolvedConfig,
    message,
  };
  ctxRef.current = ctx;

  maybeShowFirstRunHint(ctx, deps, commandPath);
  return ctx;
}

function buildProgram(deps: CliDeps, ctxRef: ContextRef, errChunks: string[]): Command {
  const program = new HelpGroupCommand();
  program
    .name(TOOL_DIR_NAME)
    .description('Search and select projects.')
    .version(`${TOOL_DIR_NAME} ${VERSION}`, '-V, --version', 'output the version number')
    .exitOverride()
    .showSuggestionAfterError(true)
    .configureOutput({
      writeOut: (text) => deps.stdout(text),
      writeErr: (text) => {
        errChunks.push(text);
      },
      getOutHelpWidth: () => (deps.stdoutIsTTY ? (process.stdout.columns ?? 80) : 80),
    })
    .addOption(new Option('-o, --output <format>', 'output format').choices(OUTPUT_FORMATS))
    .option('--json', 'shorthand for --output json')
    .option('--output-file <path>', 'write results to a file instead of stdout')
    .addOption(new Option('--log-level <level>', 'explicit console log level').choices(LOG_LEVELS))
    .option('--log-file [path]', 'enable rotating file logging (default: XDG state)')
    .option(
      '-v, --verbose',
      'increase verbosity (repeatable: -v info, -vv debug)',
      (_value: string | undefined, previous: number) => previous + 1,
      0
    )
    .option('-q, --quiet', 'suppress non-essential stderr output', false)
    .option('--debug', 'maximum diagnostics; enables debug logs and stack traces', false)
    .option('--no-color', 'disable colored output')
    .option('--no-input', 'never prompt; disable interactive pager')
    .option('--config <path>', 'path to config file (replaces discovery)')
    .option('--token <token>', 'personal access token');

  const initContext = (commandPath: string): CliContext =>
    buildContext(program, deps, commandPath, ctxRef);

  registerProjectsCommand(program, deps, initContext);
  registerConfigCommand(program, deps, initContext);
  registerDoctorCommand(program, deps, initContext);
  registerCompletionCommand(program, deps, initContext);

  return program;
}

/**
 * Run the CLI in-process. Returns the exit code (never throws, never calls
 * `process.exit`).
 */
export async function runCli(argv: string[], deps: CliDeps): Promise<number> {
  const ctxRef: ContextRef = { current: undefined, outputMode: undefined, colors: undefined };
  const errChunks: string[] = [];
  const program = buildProgram(deps, ctxRef, errChunks);
  try {
    await program.parseAsync(argv, { from: 'user' });
    return EXIT_CODES.success;
  } catch (err) {
    if (err instanceof CommanderError) {
      if (err.exitCode === 0) {
        return EXIT_CODES.success;
      }
      const rawErrText = errChunks.join('');
      if (fallbackIsJson(program, deps)) {
        const firstLine = (rawErrText.split('\n', 1)[0] ?? err.message).trim();
        const normalized = firstLine.startsWith('error: ')
          ? firstLine.slice('error: '.length)
          : firstLine;
        const message = normalized !== '' ? normalized : err.message;
        deps.stderr(`${formatJsonError({ exitCode: EXIT_CODES.usage, message })}\n`);
      } else if (rawErrText !== '') {
        deps.stderr(rawErrText);
      }
      return EXIT_CODES.usage;
    }
    if (err instanceof SilentExitError) {
      return err.exitCode;
    }
    if (err instanceof Error && err.name === 'ExitPromptError') {
      deps.stderr('Cancelled.\n');
      return EXIT_CODES.sigint;
    }

    const isDomainOrCli = err instanceof DomainError || err instanceof CliError;
    const exitCode = exitCodeFor(err);
    const rawMessage = err instanceof Error ? err.message : String(err);
    const isJson =
      ctxRef.outputMode !== undefined
        ? ctxRef.outputMode === 'json'
        : fallbackIsJson(program, deps);
    const colors = ctxRef.colors ?? fallbackColors(program, deps);
    const errorCode =
      err instanceof DomainError
        ? err.code
        : err instanceof CliError
          ? err.code
          : ERROR_CODES.unexpected;
    const hint = err instanceof DomainError || err instanceof CliError ? err.hint : undefined;
    const tracebackPath = isDomainOrCli ? undefined : writeCrashLog(err, deps);

    if (isJson) {
      const concise = rawMessage.split('\n', 1)[0] ?? rawMessage;
      deps.stderr(
        `${formatJsonError({ exitCode, message: concise, errorCode, hint, tracebackPath })}\n`
      );
      return exitCode;
    }

    deps.stderr(formatHumanError({ message: rawMessage, colors, errorCode, hint, tracebackPath }));
    const opts = program.opts<GlobalOpts>();
    if ((opts.debug || opts.verbose >= 1) && err instanceof Error && err.stack !== undefined) {
      deps.stderr(`${err.stack}\n`);
    }
    return exitCode;
  }
}
