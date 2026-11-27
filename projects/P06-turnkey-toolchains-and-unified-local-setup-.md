# P06 — Turnkey toolchains and unified local setup

Add mise, flox, devcontainer, make bootstrap, just setup, and Justfile DX fixes

### Open questions

- Should `Justfile` port Py's GitHub Actions test-repo trio (`pr-to-testrepo`, `clean-pr-to-testrepo`, `create-test-pr`) as planned in D-024(1), or formally supersede that clause of D-024(1)?
- Should `just api` gain a watch/reload dev mode (`tsx watch` or `node --watch`) alongside the built-bundle mode?

### Notes

Ports Py ADR 0005 (`mise` + `flox`), `.devcontainer/`, two-level bootstrap (`make bootstrap` -> `just setup`), and fixes local `Justfile`/`Makefile` drift:

- **First-class toolchains:** Add root `mise.toml` (already referenced in `Makefile` hints!), `.flox/env/manifest.toml` + `.flox/env.json`, and `.devcontainer/{devcontainer.json,post-create.sh}` pinning the TS tool set (`node 24`, `pnpm 10`, `just`, `actionlint`, `shellcheck`, `gitleaks`, `gh`, optional `bun`).
- **Makefile Level 1 bootstrap:** Add `make bootstrap` (Node/pnpm/just setup + `make check` + `Next: just setup`), add `pnpm` and optional `docker` to `make check`, add `make hook-check`, and align `install-just-force` to `~/.local/bin` (matching `scripts/install-*.sh`) with a GitHub API rate-limit fallback.
- **Unified Level 2 `just setup`:** Combine bootstrap gate (`make check`), shell/security tool installers, `pnpm install`, `setup-hooks`, `projects/.gitkeep` restoration, and `check-deps` into one idempotent `just setup` recipe.
- **Justfile DX fixes:**
  - Fix `just clean` to also remove `apps/api/dist`, `apps/web/dist`, and `packages/core/dist`.
  - Expand `just debug-info` across all workspace packages and include `actionlint`/`shellcheck`.
  - Add `just dev` / `cycle`, `just select-shell`, `just hooks-run` (`lefthook run pre-commit --all-files`), and `just verify-commits`.
  - Reconcile `just pre-commit-run` (currently duplicates `@all` instead of running lefthook) and `just ci` (missing `check-boundaries`/`check-shell`/`check-workflows`/`docs-check` before lefthook).

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P06` when ready. -->
