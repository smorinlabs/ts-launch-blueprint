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

The server prints one line when it's ready:

```
ts-launch-blueprint api listening on :8080 (source: memory)
```

A configuration error (a bad `PORT`, a bad `TS_PROJECTS_SOURCE`, or the
`http` source without a token) stops it at startup, with the message on
stderr and a non-zero exit.

## Endpoints

| Method | Path                  | What it does                                               |
| ------ | --------------------- | ---------------------------------------------------------- |
| `GET`  | `/healthz`            | Liveness: `200 {"status":"ok"}` while the process is up    |
| `GET`  | `/readyz`             | Readiness: `200 {"status":"ready"}` once the core is built |
| `GET`  | `/trpc/projects.list` | tRPC query: list projects (optional input, see below)      |
| any    | anything else         | `404`                                                      |

### `projects.list`

A tRPC **query**, so it is a `GET`. Its input is optional and is passed as
URL-encoded JSON in `?input=`. The input and output schemas are the core's
public contract (`ListProjectsInputSchema`, `ListProjectsOutputSchema`,
D-047):

| Input field     | Type                       | Meaning                                                 |
| --------------- | -------------------------- | ------------------------------------------------------- |
| `workspaceName` | string, optional           | Workspace name, case-insensitive; empty means no filter |
| `limit`         | positive integer, optional | Maximum number of projects (default 200; no upper cap)  |

## Response Shape

tRPC wraps every response:

- **Success**: `{"result":{"data":{"projects":[…]}}}`, each project
  `{ "id", "name", "workspace": { "name" } }`.
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
  original error is logged to the server's stderr, one line per error
  (`projects.list failed: ApiError: …`). 4xx errors aren't logged.
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

## Environment Variables

| Variable              | Effect                                                                               |
| --------------------- | ------------------------------------------------------------------------------------ |
| `PORT`                | Port to listen on (default `8080`, Cloud Run's default); an integer from 1 to 65535  |
| `TS_PROJECTS_SOURCE`  | `memory` (**default for the API**: demo data, no token) or `http` (the projects API) |
| `TS_PROJECTS_TOKEN`   | Required with `TS_PROJECTS_SOURCE=http`; checked at startup                          |
| `TS_PROJECTS_API_URL` | Optional API root override for the `http` source                                     |

The CLI reads the same `TS_PROJECTS_SOURCE`, but its default is `http`; see
the [CLI Reference](./cli-reference.md).

## Container

`apps/api/Dockerfile` builds a small image (D-050): every dependency is
bundled into `dist/server.js`, so the runtime stage holds only `dist/` (no
`node_modules`) on `node:24-slim`, running as the non-root `node` user, with
`PORT=8080`. Build it from the repo root (Docker must be running):

```bash
just docker-build   # docker build -f apps/api/Dockerfile -t ts-launch-blueprint-api .
just docker-run     # docker run --rm -p 8080:8080 ts-launch-blueprint-api
just smoke          # in another terminal; or: just smoke https://your-service-url
```

`just smoke` runs `scripts/smoke-api.sh`, the same 5 checks CI runs against
the image (`/healthz`, `/readyz`, `projects.list`, an unknown workspace →
404, an unknown path → 404). Pass the URL positionally: `just smoke https://…`.

### Shutdown

On `SIGTERM` (Cloud Run, `docker stop`) or `SIGINT` (Ctrl-C), the server logs
`shutting down (SIGTERM)`, stops accepting connections, lets in-flight
requests finish, and exits **0**. If closing takes longer than 10 seconds it
exits 1. CI checks that `docker stop` on the image exits 0.

## See Also

- [Architecture](../about/architecture.md): how the API and the CLI share the core
- [Architecture Boundary Rules](./boundary-rules.md), including how to remove the API
