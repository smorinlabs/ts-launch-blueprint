# P15 — Standalone core library packaging and release wiring

**References**

- **Trunk:** [PROJECTS.md](../PROJECTS.md)
- **Predecessor:** [P10](P10-core-domain-depth-and-api-contract-snapshots.md), [P13](P13-release-runbook-and-governance-docs-polish.md)
- **ADR:** [ADR 0017](../docs/adr/0017-standalone-core-library-packaging.md)

Turn `packages/core` (`ts-launch-blueprint-core`) into a first-class, standalone TypeScript/npm library that builds, pack-checks, and publishes cleanly with zero CLI, API, or web dependencies.

### Scope

- Rename `packages/core` from `@ts-launch-blueprint/core` to unscoped `ts-launch-blueprint-core` (`Q13.A`, rebranding to `<repo_name>-core` under `template-press`) across workspace manifests, imports, `.oxlintrc.json`, `.dependency-cruiser.cjs`, tests, and documentation.
- Configure `packages/core` with modern npm/TypeScript library packaging best practices:
  - Publishable `packages/core/package.json` (`version` synced with root/manifest, `"type": "module"`, `"sideEffects": false`, `"files": ["dist"]`, `"engines": { "node": ">=24" }`, repository/homepage/bugs/keywords/author metadata, only `zod` in `dependencies`).
  - Live-source workspace `exports` (`./src/index.ts`) paired with `publishConfig.exports` (`./dist/index.d.ts` and `./dist/index.js`) plus a `prepublishOnly` guard blocking accidental bare `npm publish` without `pnpm pack`.
  - Standalone `packages/core/tsdown.config.ts` (ESM, `.d.ts` via `isolatedDeclarations`, JS sourcemaps, `treeshake: true`, `clean: true`, `zod` externalized), `packages/core/src/version.ts` (`VERSION` exported from `packages/core/src/index.ts`), dedicated `packages/core/README.md`, and `packages/core/scripts/copy-package-files.mjs` (`LICENSE` copy).
- Split `Justfile` `pack-check` into `pack-check-core` and `pack-check-cli`:
  - `pack-check-core` runs build, `publint --pack pnpm --strict`, `pnpm pack`, `attw <tarball> --profile esm-only`, tarball file-list/manifest/`sideEffects`/`dependencies === ['zod']`/externalized-`zod` assertions, and isolated consumer smoke tests (ESM runtime execution + `tsc --noEmit` under both `NodeNext` and `Bundler` module resolution).
- Wire workspace build/clean/release-status/docs-api, `scripts/check-removable.sh` standalone core build + `pack-check-core`, CI `check-removable cli api web` core-only job step, `ci.yml` `changes` detection (`packages/core/package.json` release fast-path + `packages/core/README.md` packaging input), `release-please-config.json` `extra-files`, `press/press-rules.toml` version reset + `[[clean]]`, `scripts/publish-container.mjs` version check, and `.gitignore` (`packages/core/LICENSE`, `__pycache__/`, `*.pyc`).
- Wire `.github/workflows/publish.yml` with a parallel `publish-core` job gated behind `if: vars.PUBLISH_CORE == 'true'` (`Q14.A`) using `pnpm pack` + `npm publish <tarball> --access public` over OIDC Trusted Publishing (`id-token: write`, protected `npm` environment), plus `PUBLISH_CORE` in `.github/actionlint.yaml` and updated `scripts/setup-npm-publishing.sh`, `docs/RELEASE.md`, and `docs/PROJECT_SETUP.md`.
- Record [ADR 0017](../docs/adr/0017-standalone-core-library-packaging.md) superseding the CLI-only publishing portion of [ADR 0001](../docs/adr/0001-pnpm-monorepo-and-cli-only-publishing.md).

### Out of scope

- Mutating GitHub repository variables (`PUBLISH_CORE`) or claiming/publishing `ts-launch-blueprint-core` on `npmjs.com` (maintainer action after merge).
- Replacing `alwaysBundle` in `apps/cli/tsdown.config.ts` (CLI remains self-contained so offline `pack-check` and CLI-only child repositories stay unbroken).

### Decisions

- **Q13.A (2026-11-28):** Rename `packages/core` to unscoped `ts-launch-blueprint-core` (`<repo_name>-core` in pressed child repositories) so publishing requires no per-repository npm organization.
- **Q14.A (2026-11-28):** Run `publish-core` as a parallel job in `.github/workflows/publish.yml` gated by `if: vars.PUBLISH_CORE == 'true'` while `verify` always validates `just pack-check` on both `packages/core` and `apps/cli`.

### Tests & Tasks

- [x] [P15-TS01] Add TDD unit/contract tests in `packages/core/tests/version.test.ts`, `packages/core/tests/public-api.test.ts`, `tests/repo-hygiene.test.ts`, `tests/ci-change-detection.test.ts`, `tests/setup-scripts.test.ts`, `tests/press-config.test.ts`, `tests/press-acceptance.test.ts`, `tests/publish-container.test.ts`, and `tests/boundaries.test.ts` covering `ts-launch-blueprint-core` packaging metadata, `VERSION`, `guard-publish.mjs`, `publishConfig.exports`, `release-please` + `ci.yml` + `publish.yml` (`publish-core` + `vars.PUBLISH_CORE`), `check-removable cli api web`, and `template-press` rules.
- [x] [P15-T01] Rename `@ts-launch-blueprint/core` to `ts-launch-blueprint-core` across workspace packages, imports, `.oxlintrc.json`, `.dependency-cruiser.cjs`, and `pnpm-lock.yaml`, and configure `packages/core` standalone build (`tsdown.config.ts`, `package.json`, `src/version.ts`, `README.md`, `scripts/copy-package-files.mjs`, `scripts/guard-publish.mjs`).
- [x] [P15-T02] Implement `pack-check-core`, `pack-check-cli`, `pack-check`, updated `build`/`clean`/`release-status`/`docs-api` in `Justfile` + root `package.json`, and standalone core build + `pack-check-core` in `scripts/check-removable.sh`.
- [x] [P15-T03] Wire `.github/workflows/ci.yml`, `.github/workflows/publish.yml`, `.github/actionlint.yaml`, `release-please-config.json`, `press/press-rules.toml`, `scripts/setup-npm-publishing.sh`, `scripts/publish-container.mjs`, and `.gitignore`.
- [x] [P15-T04] Write `docs/adr/0017-standalone-core-library-packaging.md`, mark ADR 0001 partially superseded, update docs (`README.md`, `AGENTS.md`, `llms.txt`, `docs/RELEASE.md`, `docs/PROJECT_SETUP.md`, `docs/about/architecture.md`, `docs/about/design-decisions.md`, `docs/reference/*`, `docs/tasks/*`, `.coderabbit.yaml`, `.greptile/rules.md`, `.claude/skills/new-ts-project/SKILL.md`), and pass all local + CI verification gates.
