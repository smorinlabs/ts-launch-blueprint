# 0012. React + Vite web app over a types-only AppRouter import

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`D-054`, `D-055`)
- **Related:** `apps/web/src/trpc.ts`, `apps/api/package.json`, `docs/reference/web-app.md`

## Context

The browser client (`apps/web`) needs end-to-end TypeScript types from
`apps/api`'s tRPC router without bundling server dependencies (Hono, Pino,
`@prometheus-io/client`, OpenTelemetry) into client JavaScript or duplicating
response DTO definitions.

## Decision

We will build `apps/web` with **React 19 + Vite + TanStack Query** importing
only the `AppRouter` **type** from `@ts-launch-blueprint/api/router`:

- `apps/api/package.json` exposes `./router` with only a `"types"` condition,
  and `[web-types-only-from-api]` in Oxlint and `dependency-cruiser` forbids any
  runtime import from `apps/api`.
- The UI keeps URL-synchronized workspace filter state (`?workspace=`), avoids
  retrying 4xx tRPC errors (`createQueryClient()`), and uses accessible plain CSS
  with semantic landmarks (`<output>`, `role="alert"`).

## Consequences

- Browser bundles stay small (~87 kB gzipped) and guaranteed free of Node/server
  code, verified by bundle-inspection tests.
- API type changes surface immediately in `just typecheck` without codegen.

## Alternatives considered

- **Hand-written `fetch` client or generated OpenAPI SDK** — requires extra
  codegen steps and risks type drift against tRPC procedures.
