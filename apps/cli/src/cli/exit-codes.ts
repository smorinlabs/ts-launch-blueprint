// CLI error reporting: the cli-standards R6.1 exit-code contract
// (D-016(2)): generic/config error -> 1, usage -> 2, not-found -> 3,
// auth (missing/invalid token) -> 4, conflict -> 5. SIGINT -> 130 and
// SIGTERM -> 143 are handled in the process entry (src/cli.ts).
//
// Domain errors (from @ts-launch-blueprint/core) carry no exit code; this
// module is the CLI controller's mapping from them to R6.1 codes.
//
// Source mapping (py_launch_blueprint/projects.py + EXAMPLECLI.md, per
// D-016(2)/D-024(11)): the Python source used 1 for config AND missing
// token, 3 for API errors, 4 for unexpected exceptions. The port adopts
// the normative cli-standards ladder instead; the mapping table lives in
// EXAMPLECLI.md.
import {
  AuthError,
  ConfigError,
  ConflictError,
  type ErrorCode,
  InterruptError,
  NotFoundError,
} from '@ts-launch-blueprint/core';

/** Exit codes per cli-standards R6.1 (D-016(2)). */
export const EXIT_CODES = {
  success: 0,
  error: 1,
  usage: 2,
  notFound: 3,
  auth: 4,
  conflict: 5,
  sigint: 130,
  sigterm: 143,
} as const;

/** Union of the R6.1 exit-code values. */
export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

/** Optional structured metadata accepted by CliError and UsageError. */
export interface CliErrorOptions {
  readonly hint?: string | undefined;
  readonly code?: ErrorCode | undefined;
  readonly cause?: unknown;
}

/** Base class for all CLI errors that carry an exit code. */
export class CliError extends Error {
  readonly exitCode: ExitCode;
  readonly hint?: string | undefined;
  readonly code?: ErrorCode | undefined;

  constructor(message: string, exitCode: ExitCode = EXIT_CODES.error, options?: CliErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'CliError';
    this.exitCode = exitCode;
    if (options?.hint !== undefined) {
      this.hint = options.hint;
    }
    if (options?.code !== undefined) {
      this.code = options.code;
    }
  }
}

/** Usage errors (bad flag/argument, nonexistent --config path) -> exit 2. */
export class UsageError extends CliError {
  constructor(message: string, options?: CliErrorOptions) {
    super(message, EXIT_CODES.usage, options);
    this.name = 'UsageError';
  }
}

/** Central error -> exit-code mapping (cli-standards R6.1, D-016(2)). */
export function exitCodeFor(err: unknown): ExitCode {
  if (err instanceof CliError) {
    return err.exitCode;
  }
  if (err instanceof InterruptError) {
    return EXIT_CODES.sigint;
  }
  if (err instanceof NotFoundError) {
    return EXIT_CODES.notFound;
  }
  if (err instanceof AuthError) {
    return EXIT_CODES.auth;
  }
  if (err instanceof ConflictError) {
    return EXIT_CODES.conflict;
  }
  if (err instanceof ConfigError) {
    return EXIT_CODES.error;
  }
  // ApiError and unexpected exceptions -> 1 (source used 4 for unexpected;
  // R6.1 reserves 4 for auth).
  return EXIT_CODES.error;
}
