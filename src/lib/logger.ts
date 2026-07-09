// Leveled stderr logger (D-018(1,3)): no logging library; writes ONLY to
// the injected stderr writer. stdout is reserved exclusively for the
// requested result (cli-standards R7.1). Level ladder per R4.1/R4.4:
// -q -> errors+warns only; default -> info; -v -> debug; -vv -> trace;
// --debug counts as at least -v and overrides --quiet; --quiet beats
// --verbose when both are given.
import type { Colors } from './colors.js';

/** Log levels in increasing verbosity. */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

const LEVEL_RANK: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

/** Verbosity flags gathered from the global CLI options. */
export interface VerbosityFlags {
  /** Count of repeated -v/--verbose occurrences. */
  verbose: number;
  quiet: boolean;
  debug: boolean;
}

/** Resolve the effective level from the flag set (cli-standards R4.4). */
export function resolveLevel(flags: VerbosityFlags): LogLevel {
  if (flags.debug) {
    // --debug ≡ at least -v, and overrides --quiet.
    return flags.verbose >= 2 ? 'trace' : 'debug';
  }
  if (flags.quiet) {
    // --quiet beats --verbose.
    return 'warn';
  }
  if (flags.verbose >= 2) {
    return 'trace';
  }
  if (flags.verbose === 1) {
    return 'debug';
  }
  return 'info';
}

/** Leveled logger; every method writes a line to the injected stderr. */
export interface Logger {
  readonly level: LogLevel;
  error: (message: string) => void;
  warn: (message: string) => void;
  info: (message: string) => void;
  debug: (message: string) => void;
  trace: (message: string) => void;
}

/** Build a logger over an injected stderr writer (claim-npm pattern). */
export function createLogger(
  stderr: (text: string) => void,
  level: LogLevel,
  colors: Colors
): Logger {
  const max = LEVEL_RANK[level];
  const emit = (rank: number, line: string): void => {
    if (rank <= max) {
      stderr(`${line}\n`);
    }
  };
  return {
    level,
    error: (message) => emit(0, colors.error(`Error: ${message}`)),
    warn: (message) => emit(1, colors.warn(`Warning: ${message}`)),
    info: (message) => emit(2, message),
    debug: (message) => emit(3, colors.dim(`debug: ${message}`)),
    trace: (message) => emit(4, colors.dim(`trace: ${message}`)),
  };
}
