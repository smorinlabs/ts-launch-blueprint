// Commander v15 program factory wrapped in DI (D-016(1)): thin entry
// (src/cli.ts) calls runCli(argv, deps) -> exit code; tests call it
// in-process with injected writers/env (claim-npm CliDeps pattern).
//
// Port of the source CLI surface (py_launch_blueprint/projects.py
// docstring + option surface, lines 24-63/320-353) with the D-031 fix:
// the source's "fuzzy matching" docstring claim was false advertising
// and is not carried. Usage errors map to exit 2 via exitOverride
// (Commander defaults to 1; D-016(2)); did-you-mean suggestions come
// from Commander's built-in showSuggestionAfterError (D-016(8)).
import { homedir as osHomedir } from 'node:os';

import { Command, CommanderError } from 'commander';

import { registerProjectsCommand } from './commands/projects.js';
import {
  type ClipboardWriter,
  type Prompter,
  realClipboard,
  realPrompter,
  realSpinner,
  type SpinnerFactory,
} from './lib/adapters.js';
import { type Colors, colorEnabled, createColors } from './lib/colors.js';
import { type ConfigFs, redactToken, requireToken, resolveConfig } from './lib/config.js';
import { EXIT_CODES, exitCodeFor } from './lib/errors.js';
import { createLogger, type Logger, resolveLevel } from './lib/logger.js';
import { VERSION } from './version.js';

/** Injected dependencies for the CLI (claim-npm CliDeps pattern). */
export interface CliDeps {
  /** Result stream — the requested output ONLY (cli-standards R7.1). */
  stdout: (text: string) => void;
  /** Diagnostics stream — logs, errors, remediation guidance. */
  stderr: (text: string) => void;
  env: Record<string, string | undefined>;
  homedir: () => string;
  stdoutIsTTY: boolean;
  stderrIsTTY: boolean;
  /** TTY-ness of stdin — gates the interactive multi-select. */
  stdinIsTTY: boolean;
  /** fs surface for config discovery/reading (defaults to node:fs). */
  fs?: ConfigFs | undefined;
  /** HTTP transport seam — the API client's only transport (D-019(5)). */
  fetchImpl: typeof fetch;
  /** Interactive multi-select seam (D-016(6)). */
  prompter: Prompter;
  /** Clipboard seam for --copy (D-016(7)). */
  clipboard: ClipboardWriter;
  /** Spinner seam; invoked only when TTY/CI gating allows (D-016(5)). */
  spinner: SpinnerFactory;
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
    stdoutIsTTY: process.stdout.isTTY ?? false,
    stderrIsTTY: process.stderr.isTTY ?? false,
    stdinIsTTY: process.stdin.isTTY ?? false,
    fetchImpl: globalThis.fetch,
    prompter: realPrompter,
    clipboard: realClipboard,
    spinner: realSpinner,
  };
}

/** Global option values shared by every command. */
export interface GlobalOpts {
  verbose: number;
  quiet: boolean;
  debug: boolean;
  color: boolean;
  /** false when --no-input was passed (Commander negated-flag key). */
  input: boolean;
  config?: string;
  token?: string;
}

/** Per-invocation context derived from the global options. */
export interface CliContext {
  opts: GlobalOpts;
  colors: Colors;
  logger: Logger;
}

function buildContext(program: Command, deps: CliDeps): CliContext {
  const opts = program.opts<GlobalOpts>();
  const colors = createColors(
    colorEnabled({
      noColorFlag: opts.color === false,
      env: deps.env,
      isTTY: deps.stderrIsTTY,
    })
  );
  const logger = createLogger(
    deps.stderr,
    resolveLevel({ verbose: opts.verbose, quiet: opts.quiet, debug: opts.debug }),
    colors
  );
  return { opts, colors, logger };
}

function buildProgram(deps: CliDeps): Command {
  const program = new Command();
  program
    .name('ts-projects')
    .description('Search and select projects.')
    .version(`ts-projects ${VERSION}`, '-V, --version', 'output the version number')
    // Usage errors must exit 2 (cli-standards R6.1); Commander defaults
    // to 1, so exitOverride routes everything through runCli's mapping.
    .exitOverride()
    .showSuggestionAfterError(true)
    .configureOutput({
      writeOut: (text) => deps.stdout(text),
      writeErr: (text) => deps.stderr(text),
    })
    .option(
      '-v, --verbose',
      'increase verbosity (repeatable: -v debug, -vv trace)',
      (_value: string | undefined, previous: number) => previous + 1,
      0
    )
    .option('-q, --quiet', 'only show warnings and errors', false)
    .option('--debug', 'maximum diagnostics; implies -v and overrides -q', false)
    .option('--no-color', 'disable colored output')
    .option('--no-input', 'never prompt; select all fetched projects')
    .option('--config <path>', 'path to config file (replaces discovery)')
    .option('--token <token>', 'personal access token');

  registerProjectsCommand(program, deps, () => buildContext(program, deps));

  const configCommand = program
    .command('config')
    .description('inspect the resolved configuration')
    .option('--show', 'print effective configuration values (secrets redacted)', false);
  configCommand.action((cmdOpts: { show: boolean }) => {
    const { logger } = buildContext(program, deps);
    if (!cmdOpts.show) {
      deps.stdout(configCommand.helpInformation());
      return;
    }
    const globals = program.opts<GlobalOpts>();
    const resolved = resolveConfig({
      flagToken: globals.token,
      configPathFlag: globals.config,
      env: deps.env,
      homedir: deps.homedir,
      fs: deps.fs,
      warn: (message) => logger.warn(message),
    });
    const token = requireToken(resolved, deps.env, deps.homedir);
    // Leveled diagnostics (D-018(3)): info by default, debug at -v,
    // trace at -vv; -q drops info. All on stderr, never stdout.
    logger.info(`resolved configuration (config file: ${resolved.configPath ?? 'none'})`);
    logger.debug(`token source: ${resolved.tokenSource}`);
    logger.trace('configuration resolution complete');
    const lines = [
      `token = "${redactToken(token)}" (source: ${resolved.tokenSource})`,
      `workspace = ${resolved.workspace === undefined ? '(unset)' : `"${resolved.workspace}"`}`,
      `limit = ${resolved.limit === undefined ? '(unset)' : String(resolved.limit)}`,
      `config_file = ${resolved.configPath ?? '(none)'}`,
    ];
    deps.stdout(`${lines.join('\n')}\n`);
  });

  return program;
}

/**
 * Run the CLI in-process. Returns the exit code (never throws, never
 * calls process.exit) so the entry can set process.exitCode and tests
 * can assert codes directly (D-016(1,2)).
 */
export async function runCli(argv: string[], deps: CliDeps): Promise<number> {
  const program = buildProgram(deps);
  try {
    await program.parseAsync(argv, { from: 'user' });
    return EXIT_CODES.success;
  } catch (err) {
    if (err instanceof CommanderError) {
      // --help / -V land here with exitCode 0; Commander already wrote
      // the message via configureOutput. Everything else is usage -> 2.
      return err.exitCode === 0 ? EXIT_CODES.success : EXIT_CODES.usage;
    }
    const { opts, logger } = buildContext(program, deps);
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
    // Source --verbose traceback intent: stack traces only under
    // --debug or -v and up (D-018(3)).
    if ((opts.debug || opts.verbose >= 1) && err instanceof Error && err.stack !== undefined) {
      deps.stderr(`${err.stack}\n`);
    }
    return exitCodeFor(err);
  }
}
