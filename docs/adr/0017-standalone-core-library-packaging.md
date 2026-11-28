# 0017. Standalone core library packaging and opt-in npm publishing

- **Status:** Accepted (supersedes CLI-only publishing in [ADR 0001](0001-pnpm-monorepo-and-cli-only-publishing.md))
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`Q13.A`, `Q14.A`, `P15`)
- **Related:** [ADR 0001](0001-pnpm-monorepo-and-cli-only-publishing.md), [ADR 0009](0009-layered-core-and-boundary-enforcement.md), `packages/core/package.json`, `packages/core/tsdown.config.ts`, `.github/workflows/publish.yml`, `Justfile`

## Context

[ADR 0001](0001-pnpm-monorepo-and-cli-only-publishing.md) kept `packages/core` as a private, source-only TypeScript workspace package (`@ts-launch-blueprint/core`) bundled into `apps/cli`. Downstream adopters and external consumers may want to consume the pure domain core (Zod schemas, repositories, domain errors, and services) as an independent npm library without pulling in any CLI, HTTP API, or web dependencies — or delete every app (`apps/cli`, `apps/api`, `apps/web`) and keep a pure library repository.

Making `packages/core` independently publishable raises three design seams:

1. **Public npm package name** for both this blueprint and `template-press`-rebranded child repositories.
2. **Workspace development vs. published `dist/` exports** without breaking zero-build live TypeScript resolution (`tsc --noEmit`, Vitest, `tsx`, `depcruise`, parallel `just all`) or OIDC Trusted Publishing via Node's `npm` CLI (`D-035`).
3. **Release workflow activation** when the core package has not yet been claimed or linked to a Trusted Publisher on `npmjs.com`.

## Decision

We will package `packages/core` as a first-class, standalone ESM TypeScript library while preserving zero-build workspace ergonomics and standalone CLI distribution:

1. **Unscoped package identity (`Q13.A`):** Rename `packages/core` from `@ts-launch-blueprint/core` to unscoped `ts-launch-blueprint-core` (`<repo_name>-core` in stamped child repositories). This matches unscoped `ts-launch-blueprint` and avoids requiring a dedicated npm organization per repository name.
2. **Standalone library build and manifest best practices:**
   - Remove `"private": true`, align `version` with the workspace root and `.release-please-manifest.json` via `release-please` `extra-files` (and reset to `0.1.0` via `template-press` `[[edit]]`), set `"type": "module"`, `"sideEffects": false`, `"files": ["dist"]`, `"engines": { "node": ">=24" }`, and full repository/homepage/bugs/keywords metadata.
   - Build `packages/core` with `packages/core/tsdown.config.ts` (ESM-only, `.d.ts` via `isolatedDeclarations`, JS sourcemaps, `treeshake: true`, `clean: true`), keeping `zod` strictly external (`neverBundle: ['zod']`), exporting single-source `VERSION`, shipping a dedicated library `packages/core/README.md`, and copying root `LICENSE` during build.
   - Keep live TypeScript paths in top-level `exports` (`./src/index.ts`) so `tsc --noEmit`, Vitest, `tsx`, `depcruise`, and parallel `just all` stay zero-build with no stale-`dist` drift; define built `./dist/index.d.ts` and `./dist/index.js` in `publishConfig.exports` (rewritten automatically by `pnpm pack`), backed by a `prepublishOnly` guard (`packages/core/scripts/guard-publish.mjs`) that rejects accidental bare `npm publish` from `packages/core`.
3. **Standalone verification in `just pack-check` and CI:**
   - Split `just pack-check` into `pack-check-core` and `pack-check-cli`. `pack-check-core` validates `publint --pack pnpm --strict`, `pnpm pack`, `attw <tarball> --profile esm-only`, tarball file/manifest/`sideEffects: false`/`dependencies === ['zod']`/external-`zod` assertions, and isolated consumer smoke tests for both ESM runtime execution and `tsc --noEmit` under `NodeNext` and `Bundler` module resolution.
   - Run `just pack-check-core` inside `scripts/check-removable.sh` and wire `just check-removable cli api web` into `.github/workflows/ci.yml` so every PR proves `packages/core` builds, tests, typechecks, and packs standalone with all apps deleted.
4. **CLI stays self-contained:** `apps/cli/tsdown.config.ts` continues bundling `ts-launch-blueprint-core` (`alwaysBundle`) so the CLI package stays installable offline during `pack-check-cli` and in child repositories that publish only the CLI.
5. **Opt-in parallel OIDC publish (`Q14.A`):** `.github/workflows/publish.yml` always validates `packages/core/package.json` version parity and runs `just pack-check` (both core and CLI) in `verify`. A parallel `publish-core` job (`needs: verify`, `environment: npm`, `id-token: write`) packs with `pnpm pack` and runs `npm publish <tarball> --access public`, gated by `if: vars.PUBLISH_CORE == 'true'` so `v*` releases stay green until a maintainer claims the package name, configures its `npmjs.com` Trusted Publisher, and sets `PUBLISH_CORE=true`.

## Consequences

- External consumers can install `ts-launch-blueprint-core` with only `zod` as a runtime dependency and zero CLI/API/web code or dependencies.
- Adopters who want a pure library repository can delete `apps/cli`, `apps/api`, and `apps/web` (`just check-removable cli api web` proves this on every PR).
- Workspace development stays live (no rebuild required before `just typecheck`, `just test`, or `just check-boundaries`).
- Publishing `packages/core` manually requires `pnpm pack` followed by `npm publish <tarball> --access public` (enforced by `guard-publish.mjs`), and automated CI publishing requires setting the `PUBLISH_CORE=true` repository variable after configuring the npmjs.com Trusted Publisher.

## Alternatives considered

- **Keep scoped `@ts-launch-blueprint/core` (`Q13.B`) or `@smorinlabs/ts-launch-blueprint-core` (`Q13.C`)** — requires registering an npm organization matching `@<repo_name>` (per repository) or `@<owner>` before publishing.
- **Point top-level `exports` directly at `./dist/*`** — forces rebuilding `packages/core` before `tsc --noEmit`, Vitest, `tsx`, and `depcruise`, introducing stale-`dist` drift and races under parallel `just all`.
- **Run `publish-core` unconditionally on every `v*` tag (`Q14.B`)** — turns `Publish` runs red on every release until a Trusted Publisher is registered for core, including in child repositories that only publish the CLI.
- **Have `apps/cli` depend on `ts-launch-blueprint-core` at runtime instead of bundling** — breaks offline `pack-check-cli` before a version is published to npm, couples CLI releases to registry propagation timing, and breaks CLI-only child repositories.
