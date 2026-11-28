# P06 — Turnkey toolchains and unified local setup

**References**

- **Trunk:** [PROJECTS.md](../PROJECTS.md)
- **Design:** [TS_PORT_DECISIONS.md](../docs/port/TS_PORT_DECISIONS.md)

Add mise, flox, devcontainer, make bootstrap, just setup, and Justfile DX fixes

### Scope

- **First-class toolchains:** Add root `mise.toml` (already referenced in `Makefile` hints), `.flox/{env/manifest.toml,env.json,.gitignore,.gitattributes}`, and `.devcontainer/{devcontainer.json,post-create.sh}` synced to the TS toolset (`node` 24 matching `.nvmrc`, `pnpm` 10.34.3 matching `package.json`, `just`, `actionlint` 1.7.12, `shellcheck` 0.11.0, `gitleaks` 8.27.2, `gh`, `make`/`gnumake`, and optional/advisory `bun` 1.3.14).
- **Makefile Level 1 bootstrap:** Add `make bootstrap` (Node/pnpm/just setup + `make check` + `Next: just setup` hint), add `pnpm` (required) and `docker` (optional) to `make check`, add `make hook-check` (verifying external binaries plus workspace-installed hook tools in `node_modules/.bin`), align `install-just`/`install-just-force` to `~/.local/bin` (matching `scripts/install-*.sh`) with a GitHub API rate-limit fallback, and add optional `install-docker`/`install-docker-force`/`install-flox` targets.
- **Unified Level 2 `just setup`:** Combine bootstrap gate (`make check`), pinned analyzer/security installers (`install-shell-tools`, `install-editorconfig-checker`, `install-gitleaks`), `pnpm install`, `setup-hooks`, `projects/.gitkeep` restoration when `PROJECTS.md` exists, and `check-deps` into one idempotent `just setup` recipe.
- **Justfile DX fixes:**
  - Fix `just clean` to remove `apps/*/dist` and `packages/*/dist` (including `apps/api/dist`, `apps/web/dist`, `packages/core/dist`), not just `apps/cli/dist`.
  - Expand `just debug-info` across all workspace packages (dynamically so `just check-removable` stays green) and report `actionlint`, `shellcheck`, `gitleaks`, and `editorconfig-checker`.
  - Add `just dev` / `cycle`, `just select-shell`, `just hooks-run` (`hooks`), `just verify-commits`, `just api-dev`, and surface `gitleaks` in `check-deps`.
  - Reconcile `just pre-commit-run` (delegate to `pnpm exec lefthook run pre-commit --all-files` instead of duplicating `@all`) and `just ci` (run full `@all` + `docs-check` + `build` before `lefthook`).
  - Formally supersede `D-024(1)`'s unimplemented GitHub Actions test-repo Justfile trio (`pr-to-testrepo`, `clean-pr-to-testrepo`, `create-test-pr`).
- **Docs & test parity:** Update `README.md`, `docs/tasks/setting-up-development.md`, `docs/tutorials/full-project-setup.md`, `docs/tools/makefiles.md`, `docs/tools/justfiles.md`, `press/stubs/readme.md`, and `press/stubs/application-setup.md` (plus `cspell.json`/`.oxfmtrc.json` if new vocabulary requires it).
- Complete mandatory `ci-fix --optimize` closeout on the measured green PR CI run.

### Out of scope

- Shipping Python `codespell`, `ruff`, `taplo`, or `yamlfmt` in `mise.toml` or `.flox/env/manifest.toml` (`P05` uses Node-native `cspell`, `oxfmt` handles TOML/YAML/JSON/Markdown, and `oxlint`/`cspell`/`commitlint`/`lefthook` install via `pnpm`).
- Implementing `D-024(1)`'s `pr-to-testrepo`, `clean-pr-to-testrepo`, and `create-test-pr` recipes (superseded by `tests/press-acceptance.test.ts` and CI workflows).
- Fork guard (`scripts/guard.sh`), `bootstrap-acceptance.yml`, and `new-ts-project` skill (covered by `P07`, launched after `P06` merges).

### Decisions

- **Keep `just api` built-bundle + add `just api-dev`:** Keep `just api` (`pnpm --filter @ts-launch-blueprint/api build && node apps/api/dist/server.js`) so existing `docs/`, `README.md`, and smoke assumptions remain intact, and add `just api-dev` (`pnpm --filter @ts-launch-blueprint/api exec tsx watch src/server.ts`, using workspace-root `tsx`) for watch/reload development.
- **Supersede `D-024(1)` test-repo trio:** Formally supersede `D-024(1)`'s unimplemented GitHub Actions test-repo Justfile trio (`pr-to-testrepo`, `clean-pr-to-testrepo`, `create-test-pr`) in `docs/port/TS_PORT_DECISIONS.md` and `Justfile` rather than porting it.
- **Toolchain parity without Python `codespell`:** Omit `codespell` (and `ruff`/`taplo`/`yamlfmt`/`lefthook`) from `mise.toml`/`.flox/` because `P05` adopted Node-native `cspell` (`Q9.A`) and workspace `devDependencies` supply `oxfmt`, `oxlint`, `cspell`, `commitlint`, and `lefthook`.
- **Closeout:** Mandatory `ci-fix --optimize` pass on the measured green PR CI run before `--merge`.

### Tests & Tasks

- [x] [P06-TS01] Add `tests/repo-hygiene.test.ts` assertions validating `mise.toml`, `.flox/{env/manifest.toml,env.json}`, and `.devcontainer/{devcontainer.json,post-create.sh}` declare the synced TS toolset (`node` 24, `pnpm` 10, `just`, `actionlint` 1.7.12, `shellcheck` 0.11.0, `gitleaks` 8.27.2, `gh`, `make`/`gnumake`, optional `bun` 1.3.14) with no `codespell`/`taplo`/`yamlfmt`.
- [x] [P06-TS02] Add `tests/repo-hygiene.test.ts` assertions validating `Makefile` (`bootstrap`, `hook-check`, `pnpm` + optional `docker` in `check`, `~/.local/bin` in `install-just`/`install-just-force`, `install-flox`/`install-docker`) and `Justfile` (`setup`, workspace-wide `clean` + `debug-info`, `dev`/`cycle`, `select-shell`, `hooks-run`, `verify-commits`, `api-dev`, `gitleaks` in `check-deps`, reconciled `pre-commit-run` -> `lefthook` and `ci`, and absence of `pr-to-testrepo`/`clean-pr-to-testrepo`/`create-test-pr`), updating the existing `pre-commit-run` assertion at `tests/repo-hygiene.test.ts:1352-1359`.
- [x] [P06-T01] Add root `mise.toml`, `.flox/{env/manifest.toml,env.json,.gitignore,.gitattributes}`, and `.devcontainer/{devcontainer.json,post-create.sh}` pinned to the TS toolset (ShellCheck-clean, strict JSON for `oxfmt`).
- [x] [P06-T02] Update `Makefile` with `bootstrap`, `hook-check`, `pnpm` + optional `docker` checks in `make check`, `~/.local/bin` alignment + GitHub API rate-limit fallback in `install-just`/`install-just-force`, and optional `install-docker`/`install-docker-force`/`install-flox` targets.
- [x] [P06-T03] Update `Justfile` with unified idempotent `setup`, workspace-wide `clean` (`apps/*/dist`, `packages/*/dist`) and `debug-info`, `dev`/`cycle`, `select-shell`, `hooks-run` (`hooks`), `verify-commits`, `api-dev`, `gitleaks` in `check-deps`, reconciled `pre-commit-run` and `ci`, and record formal `D-024(1)` test-repo trio supersession.
- [x] [P06-T04] Sync setup docs and press stubs (`README.md`, `docs/tasks/setting-up-development.md`, `docs/tutorials/full-project-setup.md`, `docs/tools/makefiles.md`, `docs/tools/justfiles.md`, `press/stubs/readme.md`, `press/stubs/application-setup.md`) plus `cspell.json` words if needed.
- [ ] [P06-T05] Run `just all`, `just coverage`, `just pack-check`, `just docs-check`, `just press-verify`, and `project-audit P06`; open PR, run `ci-fix --optimize` closeout on green CI, resolve review threads, mark `P06` `[x]`, and merge via `--merge`.
