# API Reference

`apps/api` is the template's HTTP API: [Hono](https://hono.dev/) for HTTP and
[tRPC](https://trpc.io/) for the business endpoint (D-043). It is the second
controller over the shared core: `projects.list` calls the same projects
service as the `ts-projects` CLI. It runs on Node (D-044) and, by default, on
the core's in-memory demo data, so it answers with **no token and no server**
(D-048).

## Running It

```bash
just api                       # build, then start on PORT (default 8080)
```

The server logs JSON lines to stdout (D-051); the first says it's ready:

```text
{"severity":"INFO","time":"…","service":"ts-launch-blueprint-api","port":8080,"source":"memory","message":"ts-launch-blueprint api listening on :8080 (source: memory)"}
```

For readable output locally, pipe it: `just api | pnpm exec pino-pretty`.
See [Observability](./observability.md) for the log fields.

A configuration error (a bad `HOST`, `PORT`, `TS_PROJECTS_SOURCE`, `LOG_LEVEL`,
`CORS_ORIGINS`, `RATE_LIMIT`, `SHUTDOWN_TIMEOUT_MS`, or the `http` source without
a token) stops it at startup, with a plain message on stderr and a non-zero
exit. A port that is already in use exits 1 with one `CRITICAL` log line.

## Endpoints

| Method | Path                  | What it does                                                                                         |
| ------ | --------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET`  | `/healthz`            | Liveness: `200 {"status":"ok","version":"…","runtime":"v…"}` while the process is up                 |
| `GET`  | `/readyz`             | Readiness: `200 {"status":"ready","checks":[…]}` or `503 application/problem+json` when failing      |
| `GET`  | `/trpc/projects.list` | tRPC query: list projects with cursor pagination (optional input, see below)                         |
| `GET`  | `/trpc/projects.get`  | tRPC query: fetch a single project by ID (`?input={"id":"p-1"}`)                                     |
| `GET`  | `/metrics`            | Prometheus metrics (unless `METRICS_ENABLED=false`); see [Observability](./observability.md#metrics) |
| any    | anything else         | `404 application/problem+json`                                                                       |

### `projects.list`

A tRPC **query**, so it is a `GET`. Its input is optional and is passed as
URL-encoded JSON in `?input=`. The input and output schemas extend the core's
public contract (`ListProjectsInputSchema`, `ListProjectsOutputSchema`,
D-047) with an API-only `MAX_API_LIMIT = 100` ceiling (`Q7.A`; `packages/core`
and `apps/cli` stay uncapped with `DEFAULT_LIMIT = 200`):

| Input field     | Type                       | Meaning                                                  |
| --------------- | -------------------------- | -------------------------------------------------------- |
| `workspaceName` | string, optional           | Workspace name, case-insensitive; empty means no filter  |
| `limit`         | positive integer, optional | Maximum number of projects (`1..100`, API ceiling `100`) |
| `cursor`        | non-empty string, optional | Opaque pagination cursor from a previous `nextCursor`    |

### `projects.get`

A tRPC **query**, so it is a `GET` requiring `?input={"id":"<project-id>"}`
(`GetProjectInputSchema`, `GetProjectOutputSchema`):

| Input field | Type             | Meaning                   |
| ----------- | ---------------- | ------------------------- |
| `id`        | non-empty string | Project identifier to get |

Returns `200 {"result":{"data":{"project":{...}}}}` or `404 NOT_FOUND` when
the project does not exist.

## Response Shape

tRPC wraps every response:

- **Success (`projects.list`)**:
  `{"result":{"data":{"projects":[…],"nextCursor":null}}}`, each project
  `{ "id", "name", "workspace": { "name" } | null }`.
- **Success (`projects.get`)**:
  `{"result":{"data":{"project":{ "id", "name", "workspace": { "name" } | null }}}}`,
- **Error**: `{"error":{"code":-32004,"message":"Workspace not found: nope","data":{"code":"NOT_FOUND","httpStatus":404,"path":"projects.list"}}}`.
  `error.data.code` is the tRPC code and `error.data.httpStatus` the HTTP
  status.

Domain errors from the core are mapped in `apps/api/src/errors.ts` (D-049):

| Case                                               | HTTP  | `error.data.code`       | `error.message`                                                  |
| -------------------------------------------------- | ----- | ----------------------- | ---------------------------------------------------------------- |
| Invalid input (for example `limit: 0`)             | `400` | `BAD_REQUEST`           | One line per field: `limit: Too small: expected number to be >0` |
| Unknown workspace (`NotFoundError`)                | `404` | `NOT_FOUND`             | The domain message: `Workspace not found: nope`                  |
| `ConflictError`                                    | `409` | `CONFLICT`              | The domain message                                               |
| Upstream rejected the server's token (`AuthError`) | `502` | `BAD_GATEWAY`           | `Upstream projects API rejected the server's credentials`        |
| Upstream failure (`ApiError`)                      | `502` | `BAD_GATEWAY`           | `Upstream projects API error`                                    |
| Anything unexpected                                | `500` | `INTERNAL_SERVER_ERROR` | `Internal server error`                                          |

- **400s** also carry `error.data.issues`, one `{ "path", "message" }` per
  problem field (the path is `input` when the whole input is wrong), so a form
  can show field errors.
- **`AuthError` is a 502, not a 401:** the token is the server's own
  configuration (`TS_PROJECTS_TOKEN`), not something the caller sent.
- **5xx messages are generic.** Upstream and unexpected errors can contain
  URLs or internal detail, so the client gets the fixed text above, and the
  original error is logged as one JSON `procedure failed` line on stdout,
  with the request's `requestId` (see [Observability](./observability.md)).
  4xx errors aren't logged.
- **Errors outside tRPC** (`404`, `429` rate limit, `500` thrown handler error,
  `503` readiness failure) return RFC 9457 `application/problem+json`
  (`{"type":"about:blank","title":"…","status":…,"detail":"…","instance":"…"}`),
  not the tRPC envelope. Rate-limited `429` responses also include `Retry-After`
  and `X-RateLimit-*` headers.
- **Security headers** (`X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  `Strict-Transport-Security`) are set on every response, including `404`,
  `429`, `OPTIONS` preflight, `500`, and `503`.
- Error bodies never contain a stack trace or file paths, whatever `NODE_ENV`
  says (`isDev: false`).

## Examples

```bash
curl -s localhost:8080/healthz
curl -s localhost:8080/trpc/projects.list
curl -s 'localhost:8080/trpc/projects.list?input=%7B%22workspaceName%22%3A%22engineering%22%7D'

# Just the projects
curl -s localhost:8080/trpc/projects.list | jq '.result.data.projects'
```

The encoded input above is `{"workspaceName":"engineering"}`.

Every response carries an `x-request-id` header. A safe incoming
`x-request-id` (1–128 characters of `A-Z a-z 0-9 . _ -`) is reused; otherwise
the server generates a UUID. The same ID is on the request's log lines.

## Idempotency, Deprecation, and Contract Snapshots

- **`Idempotency-Key` middleware (`apps/api/src/idempotency.ts`)**: `POST`,
  `PUT`, and `PATCH` requests carrying a non-empty `Idempotency-Key` header
  cache `2xx` responses per `(method, path, query, key)` (24h TTL, 1024-entry
  LRU) and replay them with `Idempotency-Replayed: true`.
- **RFC 8594 deprecation headers (`apps/api/src/versioning.ts`)**:
  `deprecationHeaders(sunset)` and `deprecationMiddleware(sunset)` format
  `Deprecation: true` and an IMF-fixdate GMT `Sunset` header.
- **API contract snapshot (`docs/api/contract.snapshot.json`)**: Generated by
  `just export-contract` (`D-043`), verified for freshness in Vitest, and
  checked for semantic breaking changes on PRs via
  `.github/workflows/api-contract.yml`.

## Environment Variables

| Variable                             | Effect                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `HOST`                               | Bind address (default `127.0.0.1`; `0.0.0.0` in `apps/api/Dockerfile`)               |
| `PORT`                               | Port to listen on (default `8080`, Cloud Run's default); an integer from 1 to 65535  |
| `CORS_ORIGINS`                       | Optional opt-in CORS origins (`*`, comma-separated, or JSON array); off when unset   |
| `RATE_LIMIT`                         | Optional opt-in rate limit (`<count>/<second\|minute\|hour\|day>`); off when unset   |
| `SHUTDOWN_TIMEOUT_MS`                | Graceful shutdown timeout in ms (default `10000`, integer `1` to `2147483647`)       |
| `TS_PROJECTS_SOURCE`                 | `memory` (**default for the API**: demo data, no token) or `http` (the projects API) |
| `TS_PROJECTS_TOKEN`                  | Required with `TS_PROJECTS_SOURCE=http`; checked at startup                          |
| `TS_PROJECTS_API_URL`                | Optional API root override for the `http` source                                     |
| `LOG_LEVEL`                          | `debug`, `info` (default), `warn`, `error` or `silent`                               |
| `METRICS_ENABLED`                    | `true` (default) or `false`; `false` turns `/metrics` off (404)                      |
| `OTEL_EXPORTER_OTLP_ENDPOINT`        | Optional; turns tracing on, exporting to `<endpoint>/v1/traces` (OTLP HTTP/JSON)     |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Optional full traces URL; wins over the base endpoint                                |
| `OTEL_SERVICE_NAME`                  | The traces' `service.name` (default `ts-launch-blueprint-api`)                       |
| `OTEL_TRACES_SAMPLER_ARG`            | Sampling ratio for new traces, `0` to `1` (default `1`)                              |
| `GCP_PROJECT_ID`                     | Optional; when set, trace fields use Cloud Logging's full trace name                 |

The CLI reads the same `TS_PROJECTS_SOURCE`, but its default is `http`; see
the [CLI Reference](./cli-reference.md).

## Container

`apps/api/Dockerfile` builds a small image (D-050): every dependency is
bundled into `dist/server.js`, so the runtime stage holds only `dist/` (no
`node_modules`) on digest-pinned `node:24-slim`, running as the non-root
`node` user, with `HOST=0.0.0.0`, `PORT=8080`, and a Node `HEALTHCHECK`
polling `/healthz`. Build it from the repo root (Docker must be running):

```bash
just docker-build   # docker build -f apps/api/Dockerfile -t ts-launch-blueprint-api .
just docker-run     # docker run --rm -p 8080:8080 ts-launch-blueprint-api
just smoke          # in another terminal; or: just smoke https://your-service-url
```

`just smoke` runs `scripts/smoke-api.sh`, the same 6 checks CI runs against
the image (`/healthz`, `/readyz`, `projects.list`, an unknown workspace →
404, an unknown path → 404, `/metrics`). Pass the URL positionally: `just smoke https://…`.

### Shutdown

On `SIGTERM` (Cloud Run, `docker stop`) or `SIGINT` (Ctrl-C), the server logs
`shutting down (SIGTERM)`, stops accepting connections, lets in-flight
requests finish, and exits **0**. If closing takes longer than
`SHUTDOWN_TIMEOUT_MS` (default 10 seconds) it exits 1. CI checks that
`docker stop` on the image exits 0.

## See Also

- [Architecture](../about/architecture.md): how the API and the CLI share the core
- [Architecture Boundary Rules](./boundary-rules.md), including how to remove the API
- [Observability](./observability.md): the API's JSON logs, metrics and traces
