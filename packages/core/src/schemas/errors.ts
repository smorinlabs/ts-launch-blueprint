// Domain errors (schema layer). They describe WHAT went wrong and carry no
// transport detail: the CLI maps them to exit codes (its exit-codes module),
// the API will map them to HTTP status. Each `name` is a stable contract:
// the CLI's JSON error envelope uses it as `code`.

/**
 * Append-only stable error codes (Py ADR 0006 parity).
 * Never reuse or renumber; new error classes claim the next free number.
 */
export const ERROR_CODES: {
  readonly unexpected: 'TS000';
  readonly config: 'TS001';
  readonly auth: 'TS002';
  readonly api: 'TS003';
  readonly interrupt: 'TS004';
  readonly projectNotFound: 'TS005';
  readonly workspaceNotFound: 'TS006';
} = {
  unexpected: 'TS000',
  config: 'TS001',
  auth: 'TS002',
  api: 'TS003',
  interrupt: 'TS004',
  projectNotFound: 'TS005',
  workspaceNotFound: 'TS006',
} as const;

/** Stable error-code string union (`TS000`–`TS006`). */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Optional structured metadata accepted by DomainError and subclasses. */
export interface DomainErrorOptions {
  readonly code?: ErrorCode | undefined;
  readonly hint?: string | undefined;
  readonly cause?: unknown;
}

/** Base class for all domain errors. */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly hint?: string | undefined;

  constructor(message: string, options?: DomainErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'DomainError';
    this.code = options?.code ?? ERROR_CODES.unexpected;
    if (options?.hint !== undefined) {
      this.hint = options.hint;
    }
  }
}

/** Configuration is missing or invalid (`TS001`). */
export class ConfigError extends DomainError {
  constructor(message: string, options?: DomainErrorOptions) {
    super(message, { ...options, code: options?.code ?? ERROR_CODES.config });
    this.name = 'ConfigError';
  }
}

/** Requested resource (e.g. a workspace) does not exist (defaults to `TS005`). */
export class NotFoundError extends DomainError {
  constructor(message: string, options?: DomainErrorOptions) {
    super(message, { ...options, code: options?.code ?? ERROR_CODES.projectNotFound });
    this.name = 'NotFoundError';
  }
}

/** Requested project does not exist (`TS005`). */
export class ProjectNotFoundError extends NotFoundError {
  constructor(message: string, options?: DomainErrorOptions) {
    super(message, { ...options, code: options?.code ?? ERROR_CODES.projectNotFound });
    this.name = 'ProjectNotFoundError';
  }
}

/** Requested workspace does not exist (`TS006`). */
export class WorkspaceNotFoundError extends NotFoundError {
  constructor(message: string, options?: DomainErrorOptions) {
    super(message, { ...options, code: options?.code ?? ERROR_CODES.workspaceNotFound });
    this.name = 'WorkspaceNotFoundError';
  }
}

/** Missing, invalid or rejected credentials (`TS002`). */
export class AuthError extends DomainError {
  constructor(message: string, options?: DomainErrorOptions) {
    super(message, { ...options, code: options?.code ?? ERROR_CODES.auth });
    this.name = 'AuthError';
  }
}

/** Conflicting state (would-overwrite etc.). */
export class ConflictError extends DomainError {
  constructor(message: string, options?: DomainErrorOptions) {
    super(message, { ...options, code: options?.code ?? ERROR_CODES.unexpected });
    this.name = 'ConflictError';
  }
}

/**
 * The data source failed (network, timeout, bad response) (`TS003`). Name kept as
 * `ApiError` because it is part of the public API (locked by the public-API
 * test); a rename is a candidate for the later public-API cleanup.
 */
export class ApiError extends DomainError {
  constructor(message: string, options?: DomainErrorOptions) {
    super(message, { ...options, code: options?.code ?? ERROR_CODES.api });
    this.name = 'ApiError';
  }
}

/** Operation interrupted / cancelled by user or signal (`TS004`). */
export class InterruptError extends DomainError {
  constructor(message: string, options?: DomainErrorOptions) {
    super(message, { ...options, code: options?.code ?? ERROR_CODES.interrupt });
    this.name = 'InterruptError';
  }
}
