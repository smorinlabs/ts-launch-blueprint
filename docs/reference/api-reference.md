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
- **Error**: `{"error":{"code":-32603,"message":"…","data":{"code":"INTERNAL_SERVER_ERROR","httpStatus":500,"path":"projects.list"}}}`.
  `error.data.code` is the tRPC code and `error.data.httpStatus` the HTTP
  status.

| Case                                   | HTTP  | `error.data.code`       |
| -------------------------------------- | ----- | ----------------------- |
| Invalid input (for example `limit: 0`) | `400` | `BAD_REQUEST`           |
| Unknown workspace                      | `500` | `INTERNAL_SERVER_ERROR` |

Error bodies never contain a stack trace or file paths, whatever `NODE_ENV`
says (`isDev: false`). Two known gaps, to be fixed by the API's error-mapping
work: an unknown workspace (`NotFoundError`) is reported as a 500 rather
than a 404, and a validation error's `message` is the raw Zod issue list.

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

## See Also

- [Architecture](../about/architecture.md): how the API and the CLI share the core
- [Architecture Boundary Rules](./boundary-rules.md), including how to remove the API
