// CLI dependency and context types (claim-npm CliDeps pattern). Their own
// module so the router and the commands both import them from here and
// neither imports the other back.
import type {
  ChoicePrompter,
  ClipboardWriter,
  ConfirmPrompter,
  PagerRunner,
  Prompter,
  SpinnerFactory,
} from './adapters.js';
import type { Colors } from './colors.js';
import type { ConfigColorMode, ConfigFs, ResolvedConfig } from './config.js';
import type { OutputFormat } from './format.js';
import type { Logger, LogLevel } from './logger.js';

/** Injected dependencies for the CLI (claim-npm CliDeps pattern). */
export interface CliDeps {
  /** Result stream — the requested output ONLY (cli-standards R7.1). */
  stdout: (text: string) => void;
  /** Diagnostics stream — logs, errors, remediation guidance. */
  stderr: (text: string) => void;
  env: Record<string, string | undefined>;
  homedir: () => string;
  cwd?: (() => string) | undefined;
  platform?: string | undefined;
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
  /** Interactive choice prompt seam for `config init`. */
  promptChoice?: ChoicePrompter | undefined;
  /** Interactive confirm prompt seam for `config set`. */
  promptConfirm?: ConfirmPrompter | undefined;
  /** Pager subprocess runner seam (defaults to realPager). */
  pager?: PagerRunner | undefined;
  /** Terminal height override for pager tests. */
  terminalRows?: number | undefined;
  /** Node.js version override for doctor tests. */
  nodeVersion?: string | undefined;
  /** OS release string override for doctor tests. */
  osRelease?: string | undefined;
  /** Clipboard seam for --copy (D-016(7)). */
  clipboard: ClipboardWriter;
  /** Spinner seam; invoked only when TTY/CI gating allows (D-016(5)). */
  spinner: SpinnerFactory;
}

/** Global option values shared by every command. */
export interface GlobalOpts {
  output?: OutputFormat | undefined;
  json?: boolean | undefined;
  outputFile?: string | undefined;
  logLevel?: LogLevel | undefined;
  logFile?: string | boolean | undefined;
  verbose: number;
  quiet: boolean;
  debug: boolean;
  color: boolean;
  /** false when --no-input was passed (Commander negated-flag key). */
  input: boolean;
  config?: string | undefined;
  token?: string | undefined;
}

/** Per-invocation context derived from the global options. */
export interface CliContext {
  opts: GlobalOpts;
  colors: Colors;
  logger: Logger;
  outputMode: OutputFormat;
  colorMode: ConfigColorMode;
  outputFile: string | undefined;
  resolvedConfig: ResolvedConfig;
  message: (text: string) => void;
}
