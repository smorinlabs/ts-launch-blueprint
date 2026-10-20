// tRPC setup for the API controller (D-043). The context carries the core,
// built once at startup by the composition root and passed in by createApp.
// Every procedure built from `publicProcedure` gets the domain-error mapping
// (D-049), so new procedures can't forget it.
import { initTRPC } from '@trpc/server';
import type { Core } from '@ts-launch-blueprint/core';

import { toTRPCError } from './errors.js';

/** Per-request context: the shared core (services over a repository). */
export interface ApiContext {
  core: Core;
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
export const publicProcedure = t.procedure.use(async ({ next }) => {
  const result = await next();
  if (!result.ok) {
    const error = result.error;
    throw error.code === 'INTERNAL_SERVER_ERROR' ? toTRPCError(error.cause ?? error) : error;
  }
  return result;
});
