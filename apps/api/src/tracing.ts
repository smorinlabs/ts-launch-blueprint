// OpenTelemetry tracing for the API (D-053): manual spans, no
// auto-instrumentation (the server is one bundle, so there are no modules to
// patch). Off unless an OTLP endpoint is configured; then a TracerProvider
// exports over OTLP HTTP/JSON, and this module wires the globals by hand
// (OpenTelemetry 3.x has no register()): without a global context manager,
// context.with does nothing, so the tRPC child spans (src/trpc.ts) and the
// log correlation (src/request-log.ts) would lose the server span.
import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  type TextMapGetter,
  trace,
  type Tracer,
} from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  SimpleSpanProcessor,
  type SpanExporter,
  TraceIdRatioBasedSampler,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import {
  ATTR_ERROR_TYPE,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
  ATTR_SERVICE_NAME,
  ATTR_URL_PATH,
} from '@opentelemetry/semantic-conventions';
import type { MiddlewareHandler } from 'hono';
import { matchedRoutes } from 'hono/route';

import { METRICS_PATH, routeLabel } from './metrics.js';
import { TRACER_NAME } from './trpc.js';

// Probes and scrapes get no span, matching the logging rule (DEBUG only).
const UNTRACED_PATHS = new Set(['/healthz', '/readyz', METRICS_PATH]);

// Reads a fetch Headers object; the default getter only reads plain objects.
const HEADERS_GETTER: TextMapGetter<Headers> = {
  get: (headers, key) => headers.get(key) ?? undefined,
  keys: (headers) => [...headers.keys()],
};

/** Tracing for one app: the HTTP server-span middleware and the flush. */
export interface Tracing {
  enabled: boolean;
  tracer: Tracer;
  httpMiddleware(): MiddlewareHandler;
  /** Flush pending spans and unregister the globals; a no-op when disabled. */
  shutdown(): Promise<void>;
}

/** The endpoint for a log line: no credentials, query or fragment. */
export function displayEndpoint(url: string): string {
  const shown = new URL(url);
  shown.username = '';
  shown.password = '';
  shown.search = '';
  shown.hash = '';
  return shown.toString();
}

/**
 * Build tracing. `tracesUrl` is the full OTLP traces URL (from config); an
 * `exporter` (tests) is used synchronously instead. With neither, tracing is
 * disabled and nothing global is touched.
 */
export function createTracing(options: {
  tracesUrl?: string | undefined;
  serviceName: string;
  sampleRatio: number;
  exporter?: SpanExporter | undefined;
}): Tracing {
  // Processors take an options object; a bare exporter crashes on flush.
  // Tests' exporter is synchronous (Simple); the OTLP one batches.
  const { tracesUrl, exporter } = options;
  let processor: SimpleSpanProcessor | BatchSpanProcessor | undefined;
  if (exporter !== undefined) {
    processor = new SimpleSpanProcessor({ exporter });
  } else if (tracesUrl !== undefined) {
    processor = new BatchSpanProcessor({ exporter: new OTLPTraceExporter({ url: tracesUrl }) });
  }
  if (processor === undefined) {
    return {
      enabled: false,
      tracer: trace.getTracer(TRACER_NAME),
      httpMiddleware: () => async (_c, next) => {
        await next();
      },
      shutdown: async () => {},
    };
  }

  const provider = new TracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: options.serviceName }),
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(options.sampleRatio) }),
    spanProcessors: [processor],
  });
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(provider);
  const tracer = provider.getTracer(TRACER_NAME);

  return {
    enabled: true,
    tracer,
    // One SERVER span per request, continuing an incoming traceparent. Its
    // name and http.route use the metrics' route pattern, known only after
    // next() (matched routes), so the span starts as `<METHOD>` and is
    // renamed. A thrown handler error is already a 500 by then (Hono /
    // app.onError), so the status is read after next(), no try/rethrow.
    httpMiddleware: () => async (c, next) => {
      if (UNTRACED_PATHS.has(c.req.path)) {
        await next();
        return;
      }
      const parent = propagation.extract(context.active(), c.req.raw.headers, HEADERS_GETTER);
      const method = c.req.method;
      const span = tracer.startSpan(
        method,
        {
          kind: SpanKind.SERVER,
          // The path only: tRPC input travels in the query string (?input=).
          attributes: { [ATTR_HTTP_REQUEST_METHOD]: method, [ATTR_URL_PATH]: c.req.path },
        },
        parent
      );
      await context.with(trace.setSpan(parent, span), next);
      const route = routeLabel(
        matchedRoutes(c).map((matched) => matched.path),
        c.req.path
      );
      const status = c.res.status;
      span.updateName(`${method} ${route}`);
      span.setAttributes({ [ATTR_HTTP_ROUTE]: route, [ATTR_HTTP_RESPONSE_STATUS_CODE]: status });
      // 4xx stays UNSET (OTel's HTTP server convention: the caller's fault).
      if (status >= 500) {
        span.setAttribute(ATTR_ERROR_TYPE, c.error?.name ?? String(status));
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      span.end();
    },
    shutdown: async () => {
      await provider.shutdown();
      trace.disable();
      context.disable();
      propagation.disable();
    },
  };
}
