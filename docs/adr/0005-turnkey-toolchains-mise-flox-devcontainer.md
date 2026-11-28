# 0005. Turnkey toolchains (mise, flox, DevContainer) with Makefile + Justfile

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`P06`, `D-024`, `D-056`)
- **Related:** `Makefile`, `Justfile`, `mise.toml`, `.flox/env/manifest.toml`, `.devcontainer/devcontainer.json`

## Context

Contributors work across macOS, Linux, Windows, and containerized environments.
A repository needs both a minimal zero-assumption bootstrap path and optional
declarative environments without duplicating task logic across Makefiles,
package scripts, and CI YAML.

## Decision

We will provide a **two-level `Makefile` + `Justfile` command surface** paired
with optional **turnkey `mise`, `flox`, and VS Code DevContainer** configs:

- `Makefile` handles **Level 1 bootstrap only** (`make check`, `make bootstrap`,
  `make install-node`, `make install-pnpm`, `make install-just`) and never wraps
  build/test tasks.
- `Justfile` is the **single command surface** for Level 2 setup (`just setup`),
  quality gates (`just all`, `just coverage`, `just pack-check`,
  `just docs-check`, `just press-verify`), builds (`just build`), and local
  runtime (`just run`, `just api`, `just web`), invoked both locally and in CI.
- `mise.toml`, `.flox/env/manifest.toml`, and `.devcontainer/` provide optional
  one-command reproducible toolchains.

## Consequences

- CI workflows and local developers run the exact same `just` recipes,
  preventing command drift.
- Legacy manual GitHub test-repo recipes (`D-024(1)`) are superseded by
  automated CI and `tests/press-acceptance.test.ts` (`D-056`).

## Alternatives considered

- **Put all tasks in `package.json` scripts or `Makefile`** — `package.json`
  handles non-Node tools (`shellcheck`, `actionlint`, `gitleaks`, `press`)
  poorly, and `Makefile` syntax is brittle for cross-platform recipes.
