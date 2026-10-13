// Domain errors (schema layer). They describe WHAT went wrong and carry no
// transport detail: the CLI maps them to exit codes (src/cli/exit-codes.ts),
// the API will map them to HTTP status. Each `name` is a stable contract:
// the CLI's JSON error envelope uses it as `code`.

/** Base class for all domain errors. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Requested resource (e.g. a workspace) does not exist. */
export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** Missing, invalid or rejected credentials. */
export class AuthError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Conflicting state (would-overwrite etc.). */
export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * The data source failed (network, timeout, bad response). Name kept as
 * `ApiError` because it is part of the public API (P1-0 test); a rename is
 * a candidate for the later public-API cleanup.
 */
export class ApiError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}
