// RFC 9457 Problem Details helper for non-tRPC HTTP errors (404, 429, 500, 503).
// /trpc/* procedures retain D-049 JSON envelopes.
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Media type for RFC 9457 Problem Details JSON responses. */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** RFC 9457 Problem Details document. */
export interface ProblemDocument {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

/** Build an RFC 9457 `application/problem+json` response. */
export function problemResponse(
  c: Context,
  options: {
    status: ContentfulStatusCode;
    title: string;
    detail?: string | undefined;
    type?: string | undefined;
    extensions?: Record<string, unknown> | undefined;
    headers?: Record<string, string> | undefined;
  }
): Response {
  const body: ProblemDocument = {
    ...options.extensions,
    type: options.type ?? 'about:blank',
    title: options.title,
    status: options.status,
    ...(options.detail !== undefined ? { detail: options.detail } : {}),
    instance: c.req.path,
  };
  return c.json(body, options.status, {
    ...options.headers,
    'Content-Type': PROBLEM_CONTENT_TYPE,
  });
}
