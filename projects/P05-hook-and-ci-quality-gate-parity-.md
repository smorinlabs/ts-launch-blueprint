# P05 — Hook and CI quality gate parity

Mirror commitlint, large-file, codespell, EditorConfig, and lockfile/TOML gates

### Open questions

- Keep TS's strict `50/72` header/body limits in `commitlint.config.mjs` (D-020(2)) or relax `body-max-line-length` and `footer-max-line-length` to `200` (matching Py) so commit bodies with URLs do not fail?
- For spelling, adopt `codespell` (cross-repo parity with Py) or a JS/TS-native tool (`cspell`) to avoid a Python runtime requirement for local lint?
- For the 3 `press/*.toml` files, enable `oxfmt` TOML support in `lefthook.yml`, adopt `taplo`, or verify `oxfmt` handles TOML natively and update `docs/tools/formatting.md`?
- Is `yamllint` (semantic YAML checks like duplicate keys/truthy values) worth adding alongside `oxfmt` YAML formatting?

### Notes

Closes Py ADR 0018 (hook <-> CI parity) and repo-hygiene drift in `ts-launch-blueprint`:

- **CI `commitlint.yml` + Dependabot config:** Enforce Conventional Commits in CI on PRs and `merge_group`, with per-author routing (`dependabot[bot]` using `commitlint.dependabot.config.mjs` so Dependabot bodies pass).
- **CI `large-file-guard.yml`:** Mirror local `lefthook.yml` `check-large-files` in CI (reconcile 500 KB vs Py's 1 MB threshold and optional `docs/assets/` allowlist).
- **`.editorconfig` + `editorconfig-checker`:** Add `.editorconfig` (covering `Makefile` tabs, `*.sh`, `*.toml`, `Dockerfile`, line endings) + `.editorconfig-checker.json` across `lefthook.yml`, `Justfile`, and CI.
- **Spelling gate:** Add `codespell` (or `cspell`) across `lefthook.yml`, `Justfile`, and CI.
- **Hook hygiene fixes:** Add `pnpm-lock.yaml` drift check when `package.json` is staged, add `press-verify` to `lefthook.yml` `pre-push`, add clear install hint to `actionlint` hook when `shellcheck` is absent, and fix `*.toml` formatting/doc drift (`docs/tools/formatting.md:76-79` claims no TOML files exist).
- **Finish D-024(7) SPDX headers:** Replace remaining 12 18-line `Copyright (c) 2025` headers in `.github/` YAML files with single-line `SPDX-License-Identifier: MIT` comments.

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P05` when ready. -->
