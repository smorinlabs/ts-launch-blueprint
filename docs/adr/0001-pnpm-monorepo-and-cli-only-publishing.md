# 0001. pnpm workspace monorepo and CLI-only npm publishing

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`D-035`, `D-040`, `D-041`, `D-045`, `Q2.A`)
- **Related:** `pnpm-workspace.yaml`, `.github/workflows/publish.yml`, `release-please-config.json`

## Context

The repository houses a shared domain core (`packages/core`), a CLI (`apps/cli`),
an HTTP/tRPC API (`apps/api`), and a React/Vite web front-end (`apps/web`).
Node-only and browser packages require distinct TypeScript compiler settings and
bundlers, yet consumers need a single installable npm CLI package (`apps/cli`)
without publishing internal server/web apps or requiring a separate build step
for `packages/core`. During the initial V1 monorepo split, npm publishing on `v*`
tags was temporarily paused (`D-045`) pending a decision on which workspace
packages to publish.

## Decision

We will structure the repository as a **pnpm 10 workspace monorepo** without
Turborepo:

- `packages/core` (`@ts-launch-blueprint/core`, `"private": true`) holds pure
  schemas, repositories, and services with no separate build step.
- `apps/cli` (`ts-launch-blueprint`) is the **sole published npm package**
  (`Q2.A`, resolving `D-045`), bundling `@ts-launch-blueprint/core` via `tsdown`
  into ESM-only `dist/` artifacts with hand-authored `exports` validated by
  `publint` and `attw`.
- `apps/api` and `apps/web` remain `"private": true`; `apps/api` is distributed
  as an immutable GHCR container image via `publish-container.yml`.
- `.github/workflows/publish.yml` triggers on `v*` tag pushes (plus
  `workflow_dispatch`) and publishes `apps/cli` using `npm publish` with OIDC
  Trusted Publishing (`id-token: write`, protected `npm` environment, zero
  `NPM_TOKEN`).

## Consequences

- Every app remains literally removable (proven by `just check-removable`).
- Installing with `pnpm` avoids Corepack and relies on `packageManager` +
  committed `pnpm-lock.yaml`; publishing uses plain `npm publish` on Node >= 24
  because `pnpm publish` had unresolved OIDC delegation issues.
- Releasing `apps/cli` is atomic via `release-please` (`package.json`,
  `apps/cli/package.json`, `.release-please-manifest.json`, `CHANGELOG.md`).

## Alternatives considered

- **Publish `packages/core` separately on npm** — adds multi-package version
  coordination overhead with no external consumer demand yet.
- **Single-package repository or Turborepo** — conflicts between browser and
  Node `tsconfig.json` settings, and Turborepo adds config complexity for four
  small packages already orchestrated by `Justfile` + `pnpm --filter`.
