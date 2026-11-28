# 0011. Hardened Hono + tRPC API and serialized contract snapshots

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`Q7.A`, `Q8.A`, `D-043`, `D-048`–`D-053`)
- **Related:** `apps/api/src/app.ts`, `apps/api/src/router.ts`, `docs/api/contract.snapshot.json`, `.github/workflows/api-contract.yml`

## Context

`apps/api` exposes tRPC business procedures alongside Cloud Run operational
endpoints (`/healthz`, `/readyz`, `/metrics`) and ships as a standalone bundled
container image (`apps/api/Dockerfile`). Clients and downstream integrators
need non-breaking pagination, safe retries, RFC-compliant error envelopes,
observability, and automated breaking-change detection.

## Decision

We will harden `apps/api` around Hono + tRPC v11 (`node:24-slim` bundled via
`tsdown`):

- **Error contracts:** tRPC middleware maps domain errors to HTTP/tRPC codes
  with generic 5xx messages (`isDev: false`); non-tRPC errors emit RFC 9457
  `application/problem+json`.
- **Pagination, idempotency, and deprecation:** `projects.list` supports
  additive `cursor` / `nextCursor` pagination with API-only `MAX_API_LIMIT = 100`
  (`Q7.A`), standalone TTL+LRU `Idempotency-Key` middleware (`Q8.A`), and RFC
  8594 deprecation headers while keeping `packages/core` read-only.
- **Security & observability:** `hono/secure-headers`, opt-in CORS/rate
  limiting, Pino Cloud Logging JSON, isolated `@prometheus-io/client` registry,
  and manual OpenTelemetry 3.x spans with `SIGTERM` flush.
- **Contract snapshots:** `just export-contract` serializes Zod/tRPC schemas to
  `docs/api/contract.snapshot.json`, checked against breaking changes by
  `.github/workflows/api-contract.yml`.

## Consequences

- `apps/api/dist/server.js` runs with zero `node_modules` in production
  containers and passes `scripts/smoke-api.sh`.
- Breaking API contract changes are caught automatically in PR CI.

## Alternatives considered

- **Full REST mirror alongside tRPC** — doubles endpoint maintenance without
  changing core capabilities.
- **Runtime-only schema checking without snapshots** — fails to catch
  backwards-incompatible field removals across PRs.
