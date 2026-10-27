// Per-request logging middleware (D-051), registered first in createApp:
// a request ID (reused when the caller sends a safe one, echoed back as
// x-request-id), Cloud Logging trace fields from x-cloud-trace-context or
// traceparent, a child logger for the request, and one `request completed`
// line after the handler. Only the path is logged, never the query string
// (tRPC input travels in ?input=). A thrown handler error doesn't reach this
// middleware: Hono turns it into a 500, so the line is written from
// c.res.status, with c.error's name when set. With tracing on (D-053), the
// trace and span IDs come from the active server span instead of the headers,
// since the tracing middleware wraps this one.
import { isSpanContextValid, trace as otelTrace, TraceFlags } from '@opentelemetry/api';
import type { MiddlewareHandler } from 'hono';

import type { Logger } from './logger.js';

/** Hono context variables set by this middleware. */
export interface RequestLogVariables {
  requestId: string;
  logger: Logger;
}

/** The trace ID (and span ID) carried by a request, if any. */
export interface TraceContext {
  traceId: string;
  spanId?: string | undefined;
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;
// x-cloud-trace-context: TRACE_ID/SPAN_ID;o=OPTIONS (trace: 32 hex; span: decimal).
const CLOUD_TRACE = /^([0-9a-f]{32})(?:\/(\d{1,20}))?(?:;o=\d)?$/i;
const MAX_SPAN_ID = 2n ** 64n - 1n;
// traceparent: VERSION-TRACE_ID-PARENT_ID-FLAGS (W3C Trace Context).
const TRACEPARENT = /^[0-9a-f]{2}-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/i;
// Probes and scrapes are frequent and routine: DEBUG, not INFO.
const PROBE_PATHS = new Set(['/healthz', '/readyz', '/metrics']);

/** The caller's x-request-id when it is safe to log and echo, else a new UUID. */
export function requestIdFrom(header: string | undefined): string {
  return header !== undefined && SAFE_REQUEST_ID.test(header) ? header : crypto.randomUUID();
}

/** A decimal Cloud Run span ID as Cloud Logging's 16 hex characters; undefined
 * when absent or above 64 bits. */
function hexSpanId(decimal: string | undefined): string | undefined {
  if (decimal === undefined || BigInt(decimal) > MAX_SPAN_ID) {
    return undefined;
  }
  return BigInt(decimal).toString(16).padStart(16, '0');
}

/** Parse x-cloud-trace-context, then traceparent; malformed headers give undefined. */
export function traceFrom(headers: {
  cloudTrace?: string | undefined;
  traceparent?: string | undefined;
}): TraceContext | undefined {
  const cloud = headers.cloudTrace === undefined ? null : CLOUD_TRACE.exec(headers.cloudTrace);
  if (cloud?.[1] !== undefined) {
    return { traceId: cloud[1].toLowerCase(), spanId: hexSpanId(cloud[2]) };
  }
  const w3c = headers.traceparent === undefined ? null : TRACEPARENT.exec(headers.traceparent);
  if (w3c?.[1] !== undefined) {
    return { traceId: w3c[1].toLowerCase(), spanId: w3c[2] };
  }
  return undefined;
}

/** Cloud Logging's trace fields for a log line. */
export function traceFields(
  trace: TraceContext | undefined,
  gcpProjectId: string | undefined
): Record<string, string> {
  if (trace === undefined) {
    return {};
  }
  const fields: Record<string, string> =
    gcpProjectId === undefined
      ? { traceId: trace.traceId }
      : { 'logging.googleapis.com/trace': `projects/${gcpProjectId}/traces/${trace.traceId}` };
  if (trace.spanId !== undefined) {
    fields['logging.googleapis.com/spanId'] = trace.spanId;
  }
  return fields;
}

/** Trace fields from the active span (tracing on), else from the headers. */
function requestTraceFields(
  headers: { cloudTrace: string | undefined; traceparent: string | undefined },
  gcpProjectId: string | undefined
): Record<string, string | boolean> {
  const active = otelTrace.getActiveSpan()?.spanContext();
  if (active === undefined || !isSpanContextValid(active)) {
    return traceFields(traceFrom(headers), gcpProjectId);
  }
  return {
    ...traceFields({ traceId: active.traceId, spanId: active.spanId }, gcpProjectId),
    'logging.googleapis.com/trace_sampled':
      (active.traceFlags & TraceFlags.SAMPLED) === TraceFlags.SAMPLED,
  };
}

/** The middleware: request ID, trace fields, child logger, one line per request. */
export function requestLog(options: {
  logger: Logger;
  gcpProjectId?: string | undefined;
}): MiddlewareHandler<{ Variables: RequestLogVariables }> {
  return async (c, next) => {
    const started = performance.now();
    const requestId = requestIdFrom(c.req.header('x-request-id'));
    const logger = options.logger.child({
      requestId,
      ...requestTraceFields(
        {
          cloudTrace: c.req.header('x-cloud-trace-context'),
          traceparent: c.req.header('traceparent'),
        },
        options.gcpProjectId
      ),
    });
    c.set('requestId', requestId);
    c.set('logger', logger);

    await next();

    c.header('x-request-id', requestId);
    const status = c.res.status;
    const line = {
      method: c.req.method,
      path: c.req.path,
      status,
      durationMs: Math.round((performance.now() - started) * 10) / 10,
      ...(c.error === undefined ? {} : { errorName: c.error.name }),
    };
    if (status >= 500) {
      logger.error(line, 'request completed');
    } else if (PROBE_PATHS.has(c.req.path)) {
      logger.debug(line, 'request completed');
    } else {
      logger.info(line, 'request completed');
    }
  };
}
