# 0009. Layered core architecture with mechanical boundary enforcement

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`D-039`, `D-042`, `D-047`)
- **Related:** `packages/core/src/index.ts`, `.dependency-cruiser.cjs`, `.oxlintrc.json`, `docs/reference/boundary-rules.md`

## Context

Shared domain logic in `packages/core` serves the CLI, the Hono/tRPC API, and
indirectly the web app's contract types. Without mechanical enforcement,
framework imports (`commander`, `hono`, `pino`, `@opentelemetry/*`), cross-app
imports, or deep imports past `packages/core/src/index.ts` silently accumulate.

## Decision

We will structure `packages/core` into `schemas/`, `repositories/`, and
`services/` wired through a single composition root (`createCore`), and enforce
all boundaries mechanically:

- **Oxlint per-directory overrides** forbid framework and cross-layer imports at
  save/pre-commit time with grep-able rule tags (`[core-no-framework-import]`,
  `[app-core-entry-only]`, `[api-core-via-create-core]`,
  `[web-types-only-from-api]`).
- **`dependency-cruiser` (`parser: 'swc'`)** verifies the full import graph
  (cycles, resolved entry points, type-only edges, `[app-no-cross-app-import]`)
  via `just check-boundaries` and probe tests in `tests/boundaries.test.ts`.
- `just check-removable` proves individual `apps/*` directories can be deleted
  without breaking `packages/core` or root tooling.

## Consequences

- Architecture boundaries are verified automatically on every commit and PR.
- Removing an app (`cli`, `api web`, `web`) is a single folder deletion.

## Alternatives considered

- **ESLint `eslint-plugin-boundaries`** — adds a second linter alongside Oxlint.
- **Prose-only conventions** — architectural rules drift without CI gates.
