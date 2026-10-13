// CLI error reporting: the cli-standards R6.1 exit-code contract
// (D-016(2)): generic/config error -> 1, usage -> 2, not-found -> 3,
// auth (missing/invalid token) -> 4, conflict -> 5. SIGINT -> 130 and
// SIGTERM -> 143 are handled in the process entry (src/cli.ts).
//
// Domain errors (src/core/schemas/errors.ts) carry no exit code; this
// module is the CLI controller's mapping from them to R6.1 codes.
//
// Source mapping (py_launch_blueprint/projects.py + EXAMPLECLI.md, per
// D-016(2)/D-024(11)): the Python source used 1 for config AND missing
// token, 3 for API errors, 4 for unexpected exceptions. The port adopts
// the normative cli-standards ladder instead; the mapping table lives in
// EXAMPLECLI.md.
import { AuthError, ConflictError, NotFoundError } from '../core/schemas/errors.js';

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

/** Base class for all CLI errors that carry an exit code. */
export class CliError extends Error {
  readonly exitCode: ExitCode;

  constructor(message: string, exitCode: ExitCode = EXIT_CODES.error) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

/** Configuration-related errors (bad file, bad schema) -> exit 1. */
export class ConfigError extends CliError {
  constructor(message: string) {
    super(message, EXIT_CODES.error);
    this.name = 'ConfigError';
  }
}

/** Usage errors (bad flag/argument, nonexistent --config path) -> exit 2. */
export class UsageError extends CliError {
  constructor(message: string) {
    super(message, EXIT_CODES.usage);
    this.name = 'UsageError';
  }
}

/** Central error -> exit-code mapping (cli-standards R6.1, D-016(2)). */
export function exitCodeFor(err: unknown): ExitCode {
  if (err instanceof CliError) {
    return err.exitCode;
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
  // ApiError and unexpected exceptions -> 1 (source used 4 for unexpected;
  // R6.1 reserves 4 for auth).
  return EXIT_CODES.error;
}
