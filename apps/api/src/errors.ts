// The API's domain-error mapping (D-049), the equivalent of the CLI's
// exitCodeFor: the core throws domain errors with no transport detail, and
// this module decides the tRPC code (and so the HTTP status) and what the
// client may see. 4xx carry the domain's own wording; 5xx carry a generic
// message, and the original stays in `cause` for the server log.
import { TRPCError } from '@trpc/server';
import { ApiError, AuthError, ConflictError, NotFoundError } from '@ts-launch-blueprint/core';

/** Client message for an AuthError: the token is server configuration, so
 * the caller can't fix it (502, not 401). */
export const UPSTREAM_AUTH_MESSAGE = "Upstream projects API rejected the server's credentials";
/** Client message for an ApiError (network, timeout, bad response). */
export const UPSTREAM_ERROR_MESSAGE = 'Upstream projects API error';
/** Client message for anything unexpected. */
export const INTERNAL_ERROR_MESSAGE = 'Internal server error';

/** Map any error to the TRPCError the client receives; `cause` is the original. */
export function toTRPCError(err: unknown): TRPCError {
  if (err instanceof TRPCError) {
    return err;
  }
  if (err instanceof NotFoundError) {
    return new TRPCError({ code: 'NOT_FOUND', message: err.message, cause: err });
  }
  if (err instanceof ConflictError) {
    return new TRPCError({ code: 'CONFLICT', message: err.message, cause: err });
  }
  if (err instanceof AuthError) {
    return new TRPCError({ code: 'BAD_GATEWAY', message: UPSTREAM_AUTH_MESSAGE, cause: err });
  }
  if (err instanceof ApiError) {
    return new TRPCError({ code: 'BAD_GATEWAY', message: UPSTREAM_ERROR_MESSAGE, cause: err });
  }
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: INTERNAL_ERROR_MESSAGE,
    cause: err,
  });
}
