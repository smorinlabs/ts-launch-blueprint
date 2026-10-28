# Observability

How the API (`apps/api`) reports what it's doing. This page covers **logs**
(D-051), **metrics** (D-052) and **traces** (D-053). The CLI isn't covered:
its stderr output is for people (see the [CLI Reference](./cli-reference.md)).

## Logs

The API writes **one JSON object per line to stdout**, using the field names
Cloud Logging reads natively. On Cloud Run, stdout is collected with no
agent or sink to configure. Logging lives in the controller: the core
(`packages/core`) never logs; it throws domain errors, and the API decides
what to write.

### Log Shape

```text
{"severity":"INFO","time":"2026-10-26T10:15:02.123Z","service":"ts-launch-blueprint-api","requestId":"7f3c…","method":"GET","path":"/trpc/projects.list","status":200,"durationMs":3.4,"message":"request completed"}
```

| Field                           | On                  | Meaning                                                                                              |
| ------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| `severity`                      | every line          | `DEBUG`, `INFO`, `WARNING`, `ERROR` or `CRITICAL`                                                    |
| `message`                       | every line          | The human text; Cloud Logging shows it as the summary                                                |
| `time`                          | every line          | ISO 8601 timestamp                                                                                   |
| `service`                       | every line          | Always `ts-launch-blueprint-api`                                                                     |
| `requestId`                     | request lines       | The request's ID (see below)                                                                         |
| `method`, `path`, `status`      | `request completed` | The request; `path` never includes the query string                                                  |
| `durationMs`                    | `request completed` | Handling time, rounded to 0.1 ms                                                                     |
| `errorName`                     | `request completed` | The thrown error's name, when a route handler threw                                                  |
| `procedure`, `err`              | `procedure failed`  | The tRPC procedure and the original error's name and message                                         |
| `logging.googleapis.com/trace`  | request lines       | `projects/<GCP_PROJECT_ID>/traces/<traceId>`, when a trace header and `GCP_PROJECT_ID` are set       |
| `traceId`                       | request lines       | The trace ID, when a trace header is set but `GCP_PROJECT_ID` isn't                                  |
| `logging.googleapis.com/spanId` | request lines       | The span ID as 16 hex characters (Cloud Run's decimal span ID is converted), when the header has one |

### What Gets Logged

- **Every request:** one `request completed` line, at `INFO` for 2xx–4xx and
  `ERROR` for 5xx.
- **Health probes and scrapes** (`/healthz`, `/readyz`, `/metrics`): logged at
  `DEBUG`, so Cloud Run's frequent probes and a scraper's requests write
  nothing at the default level. This goes by path, so with
  `METRICS_ENABLED=false` a request to `/metrics` (a 404) is logged at `DEBUG`
  too.
- **5xx from a procedure:** one extra `procedure failed` line at `ERROR`, with
  the same `requestId` and the original error. The client still gets only a
  generic message (D-049). 4xx write no error line.
- **A route handler that throws** (outside tRPC): one `handler failed` line
  at `ERROR` with the error's name and message, and the request's
  `request completed` line carries `errorName`. The client gets
  `500 {"error":"Internal server error"}`.
- **Startup and shutdown:** `… listening on :8080 (source: memory)` and
  `shutting down (SIGTERM)` at `INFO`. A busy port gives one `CRITICAL` line
  (`port 8080 is already in use`) and exit 1, with no stack trace.

A configuration error at startup is the one plain-text exception: it's
written to stderr before a logger exists.

### Levels

`LOG_LEVEL` sets the lowest level written: `debug`, `info` (default), `warn`,
`error` or `silent`. Any other value stops the server at startup.

### Request IDs

Each request gets an ID, sent back in the `x-request-id` response header and
added to every line logged for that request. A caller (or a proxy) can send
its own `x-request-id`: it's reused when it is 1–128 characters of
`A-Z a-z 0-9 . _ -`, and replaced with a new UUID otherwise.

### Trace Fields

When a request carries `x-cloud-trace-context` (`TRACE_ID/SPAN_ID;o=1`, set
by Cloud Run) or W3C `traceparent` (`00-<trace>-<span>-<flags>`), its lines
get the trace fields above, so Cloud Logging groups them under the trace.
The full trace name needs the project ID, which Cloud Run doesn't set by
default: set `GCP_PROJECT_ID` explicitly. A malformed header is ignored.

With [tracing](#traces) on, the IDs come from the active server span
instead (the span continues an incoming `traceparent`), and lines also get
`logging.googleapis.com/trace_sampled`. An `x-cloud-trace-context` header
alone isn't continued by the span; Cloud Run sends `traceparent` as well.

### Never Logged

- Query strings: tRPC input travels in `?input=` and may hold user data.
- Request and response bodies.
- Request headers, including `authorization` and `cookie`. As a safety net,
  `authorization`, `cookie` and `token` fields are redacted (`[Redacted]`) if
  anything ever logs them.

### Reading Logs Locally

The raw JSON is for machines. For readable output, pipe it through
`pino-pretty` (a root devDependency, never bundled into the server):

```bash
just api | pnpm exec pino-pretty
```

## Metrics

`GET /metrics` serves [Prometheus](https://prometheus.io/) text format
(`prom-client`), readable by any Prometheus-compatible scraper, including
Google Cloud Managed Service for Prometheus. Like logging, metrics live in
the controller; the core has none.

| Name                            | Type      | Labels                      | Meaning                                                                                                 |
| ------------------------------- | --------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `http_requests_total`           | counter   | `method`, `route`, `status` | Requests handled                                                                                        |
| `http_request_duration_seconds` | histogram | `method`, `route`, `status` | Time from request start to response                                                                     |
| `trpc_errors_total`             | counter   | `procedure`, `code`         | tRPC errors (4xx and 5xx) by procedure and code                                                         |
| default Node metrics            | various   | —                           | `process_cpu_seconds_total`, `process_resident_memory_bytes`, `nodejs_eventloop_lag_seconds`, heap, GC… |

Duration buckets (seconds): `0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5`.
`status` is the numeric status as a string (`"200"`). `/metrics` itself
isn't counted.

### Route Labels

`route` is always a **route pattern, never the raw path**: a label per URL
(`/nope/123`, `/nope/456`, scanner traffic) would create a new time series
for each one and grow memory without bound.

| Request                                                                                            | `route`               |
| -------------------------------------------------------------------------------------------------- | --------------------- |
| `/healthz`, `/readyz`                                                                              | the path itself       |
| `/trpc/projects.list` (also with `?batch=1`)                                                       | `/trpc/projects.list` |
| a batch of known procedures (`/trpc/a,b?batch=1`)                                                  | `/trpc/batch`         |
| an unknown or empty procedure (`/trpc/doesNotExist`, `/trpc`, `/trpc/`), or a batch containing one | `/trpc/unknown`       |
| anything that matched no route (a 404)                                                             | `unmatched`           |

Batching stays on: tRPC's `httpBatchLink` client sends `?batch=1` even for
a single call. Per-procedure detail inside a batch shows in
`trpc_errors_total`. Its `procedure` label is a known procedure name or
`unknown`, never a name the caller sent. tRPC errors are counted including
4xx (a rising `NOT_FOUND` rate is worth seeing), although only 5xx are
logged.

### Turning It Off

`METRICS_ENABLED` is `true` (default) or `false`. With `false`, `/metrics`
is a 404 and nothing is measured; any other value stops the server at
startup.

`/metrics` has no authentication. It holds operational numbers only, never
request data, but a public Cloud Run service exposes it to anyone. Use
`METRICS_ENABLED=false` or a private service if that matters; this will be
decided with the deploy.

### Querying

```bash
curl -s localhost:8080/metrics | grep http_requests_total
```

Example PromQL:

```text
# Request rate by route
sum(rate(http_requests_total[5m])) by (route)

# p95 latency by route
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))
```

## Traces

**Off by default.** With no OTLP endpoint configured, no tracing SDK starts
and nothing changes. Set `OTEL_EXPORTER_OTLP_ENDPOINT` and the API exports
spans over **OTLP HTTP/JSON** to `<endpoint>/v1/traces`, so any OTLP backend
works: Jaeger, an OpenTelemetry Collector, or Cloud Trace through a
collector. Spans are manual (no auto-instrumentation: the server is one
bundle, so there are no modules to patch), and the core has none.

| Variable                             | Effect                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `OTEL_EXPORTER_OTLP_ENDPOINT`        | Turns tracing on; an `http(s)` URL, `/v1/traces` added (trailing `/` ok) |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | The full traces URL, used as-is; wins over the base endpoint             |
| `OTEL_SERVICE_NAME`                  | `service.name` (default `ts-launch-blueprint-api`)                       |
| `OTEL_TRACES_SAMPLER_ARG`            | Sampling ratio for new traces, `0` to `1` (default `1`)                  |

Other `OTEL_*` variables aren't read. In particular there's **no
`OTEL_EXPORTER_OTLP_HEADERS`**: for a backend that needs auth headers, run
an OpenTelemetry Collector next to the API and let it handle auth.

### Spans

| Span               | Kind     | Attributes                                                                   |
| ------------------ | -------- | ---------------------------------------------------------------------------- |
| `<METHOD> <route>` | server   | `http.request.method`, `http.route`, `url.path`, `http.response.status_code` |
| `trpc <procedure>` | internal | `rpc.system` (`trpc`), `rpc.method`                                          |

- One server span per request. Its name and `http.route` use the [route
  patterns](#route-labels) from the metrics (`/trpc/projects.list`,
  `/trpc/batch`, `/trpc/unknown`, `unmatched`), never the raw path.
- One `trpc <procedure>` child span per procedure call, so a batch shows
  each call.
- An incoming W3C `traceparent` is continued: same trace ID, with the
  caller's span as parent.
- `/healthz`, `/readyz` and `/metrics` get no span.
- **Status:** 5xx is `ERROR` with `error.type` (the thrown error's name or
  the status code on the server span; the tRPC code, such as `BAD_GATEWAY`,
  on the procedure span). 4xx stays `UNSET`: the caller's fault, per
  OpenTelemetry's HTTP server convention.

**Never on a span:** the query string (tRPC input travels in `?input=`),
headers, bodies, or a 5xx error's message. Traces often go to a third-party
backend; the detail stays in the server log.

### Sampling

`OTEL_TRACES_SAMPLER_ARG` sets the share of **new** traces recorded. A
request that arrives with a sampled `traceparent` (flags `01`) is always
recorded, and an unsampled one never is (parent-based sampling), so a trace
across services isn't cut in half.

### Shutdown

Spans are exported in batches. On `SIGTERM`, after in-flight requests
finish, the server flushes the pending spans before exiting, within the
10-second shutdown limit, so the last requests before Cloud Run stops an
instance aren't lost.

### Viewing Traces Locally

With Docker, run Jaeger, which accepts OTLP/HTTP on port 4318:

```bash
docker run --rm -p 16686:16686 -p 4318:4318 jaegertracing/jaeger:2.22.0
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 just api   # another terminal
curl -s localhost:8080/trpc/projects.list > /dev/null
# then open http://localhost:16686 and pick the ts-launch-blueprint-api service
```

Exporting to Cloud Trace (through a collector or Google's OTLP endpoint)
will be set up with the deploy.

## See Also

- [API Reference](./api-reference.md): endpoints and environment variables
- [Architecture](../about/architecture.md): why logs, metrics and traces stay out of the core
