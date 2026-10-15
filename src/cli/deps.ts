// CLI dependency and context types (claim-npm CliDeps pattern). Their own
// module so the router and the commands both import them from here and
// neither imports the other back: cli.ts -> router.ts -> commands/* ->
// deps.ts, with no arrow pointing back.
import type { ClipboardWriter, Prompter, SpinnerFactory } from './adapters.js';
import type { Colors } from './colors.js';
import type { ConfigFs } from './config.js';
import type { Logger } from './logger.js';

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
