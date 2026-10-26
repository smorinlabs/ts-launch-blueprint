# Observability

How the API (`apps/api`) reports what it's doing. This page covers **logs**
(D-051); metrics and traces will be added here later. The CLI isn't covered:
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
- **Health probes** (`/healthz`, `/readyz`): logged at `DEBUG`, so Cloud
  Run's frequent probes write nothing at the default level.
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

## See Also

- [API Reference](./api-reference.md): endpoints and environment variables
- [Architecture](../about/architecture.md): why logging stays out of the core
