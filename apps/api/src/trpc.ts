// tRPC setup for the API controller (D-043). The context carries the core,
// built once at startup by the composition root and passed in by createApp.
// Every procedure built from `publicProcedure` gets a procedure span (D-053)
// and the domain-error mapping (D-049), so new procedures can't forget them.
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';
import { initTRPC } from '@trpc/server';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import type { Core } from '@ts-launch-blueprint/core';

import { toTRPCError } from './errors.js';
import type { Logger } from './logger.js';

/** The tracer name for the API's spans (src/tracing.ts uses it too). */
export const TRACER_NAME = 'ts-launch-blueprint-api';

// RPC attribute names: the RPC semantic conventions are still in development,
// so they aren't in @opentelemetry/semantic-conventions' stable export, and
// the incubating entry is unstable by design. Local constants instead.
const ATTR_RPC_SYSTEM = 'rpc.system';
const ATTR_RPC_METHOD = 'rpc.method';

/** Per-request context: the shared core (services over a repository), plus
 * the request's ID and child logger (set by the request middleware). */
export interface ApiContext {
  core: Core;
  requestId?: string | undefined;
  logger?: Logger | undefined;
}

/** One field-level problem in a 400 response (`error.data.issues`). */
export interface ApiIssue {
  path: string;
  message: string;
}

interface ValidationIssue {
  path: readonly PropertyKey[];
  message: string;
}

/** The issues of a Zod (or other Standard Schema) validation error, if any. */
function validationIssues(cause: unknown): ApiIssue[] | undefined {
  const issues = (cause as { issues?: unknown } | undefined)?.issues;
  if (!Array.isArray(issues)) {
    return undefined;
  }
  return (issues as ValidationIssue[]).map((issue) => ({
    path: issue.path.length === 0 ? 'input' : issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

const t = initTRPC.context<ApiContext>().create({
  // Never put stack traces (with file paths) in error responses, whatever
  // NODE_ENV says: tRPC adds data.stack unless NODE_ENV=production.
  isDev: false,
  // Readable validation errors: one `path: message` line instead of raw Zod
  // JSON, plus `data.issues` (path + message only) for field-level display.
  errorFormatter({ shape, error }) {
    const issues = error.code === 'BAD_REQUEST' ? validationIssues(error.cause) : undefined;
    if (issues === undefined) {
      return shape;
    }
    return {
      ...shape,
      message: issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '),
      data: { ...shape.data, issues },
    };
  },
});

export const router = t.router;

/** Every procedure: a domain or unexpected error thrown in the body arrives as
 * INTERNAL_SERVER_ERROR with the original as `cause`, and is mapped. tRPC's
 * own errors (BAD_REQUEST from input validation, …) pass through unchanged;
 * mapping their `cause` (a ZodError) would wrongly turn a 400 into a 500. */
const mapErrors = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok) {
    const error = result.error;
    throw error.code === 'INTERNAL_SERVER_ERROR' ? toTRPCError(error.cause ?? error) : error;
  }
  return result;
});

/** A child span per procedure call (one each inside a batch), under the HTTP
 * server span. Registered before mapErrors, so it sees the final mapped code.
 * The global tracer is a no-op until tracing registers a provider. `path` is
 * always a real procedure name: tRPC rejects an unknown one (NOT_FOUND)
 * before any middleware runs. A 5xx gets ERROR and the tRPC code, never the
 * original message: traces may go to a third-party backend, and the detail
 * stays in the server log (D-051). */
const procedureSpan = t.middleware(async ({ path, next }) =>
  trace
    .getTracer(TRACER_NAME)
    .startActiveSpan(
      `trpc ${path}`,
      { attributes: { [ATTR_RPC_SYSTEM]: 'trpc', [ATTR_RPC_METHOD]: path } },
      async (span) => {
        const result = await next();
        if (!result.ok && getHTTPStatusCodeFromError(result.error) >= 500) {
          span.setAttribute(ATTR_ERROR_TYPE, result.error.code);
          span.setStatus({ code: SpanStatusCode.ERROR });
        }
        span.end();
        return result;
      }
    )
);

export const publicProcedure = t.procedure.use(procedureSpan).use(mapErrors);
