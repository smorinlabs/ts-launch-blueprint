// Error taxonomy mapped to the cli-standards R6.1 exit-code contract
// (D-016(2)): generic/config error -> 1, usage -> 2, not-found -> 3,
// auth (missing/invalid token) -> 4, conflict -> 5. SIGINT -> 130 and
// SIGTERM -> 143 are handled in the process entry (src/cli.ts).
//
// Source mapping (py_launch_blueprint/projects.py + EXAMPLECLI.md, per
// D-016(2)/D-024(11)): the Python source used 1 for config AND missing
// token, 3 for API errors, 4 for unexpected exceptions. The port adopts
// the normative cli-standards ladder instead; the mapping table lives in
// EXAMPLECLI.md.

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

/** Requested resource (e.g. workspace) not found -> exit 3. */
export class NotFoundError extends CliError {
  constructor(message: string) {
    super(message, EXIT_CODES.notFound);
    this.name = 'NotFoundError';
  }
}

/**
 * Missing or invalid token -> exit 4 (auth, per D-016(2); the Python
 * source exited 1 here). Extends ConfigError so config-layer callers can
 * treat it as a configuration failure while the exit code stays 4.
 */
export class AuthError extends ConfigError {
  // Re-declared to widen from ConfigError's implicit 1 to auth's 4.
  override readonly exitCode: ExitCode = EXIT_CODES.auth;

  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Conflicting state (would-overwrite etc.) -> exit 5. */
export class ConflictError extends CliError {
  constructor(message: string) {
    super(message, EXIT_CODES.conflict);
    this.name = 'ConflictError';
  }
}

/** Central error -> exit-code mapping (cli-standards R6.1, D-016(2)). */
export function exitCodeFor(err: unknown): ExitCode {
  if (err instanceof CliError) {
    return err.exitCode;
  }
  // Unexpected exceptions -> 1 (source used 4; R6.1 reserves 4 for auth).
  return EXIT_CODES.error;
}
