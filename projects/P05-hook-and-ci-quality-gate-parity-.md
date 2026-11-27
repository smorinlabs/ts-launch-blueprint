# P05 — Hook and CI quality gate parity

Mirror commitlint, large-file, codespell, EditorConfig, and lockfile/TOML gates

### Open questions

- For the 3 `press/*.toml` files, enable `oxfmt` TOML support in `lefthook.yml`, adopt `taplo`, or verify `oxfmt` handles TOML natively and update `docs/tools/formatting.md`?
- Is `yamllint` (semantic YAML checks like duplicate keys/truthy values) worth adding alongside `oxfmt` YAML formatting?

### Notes

**Decisions (2026-11-27):**

- **Q9.A:** Adopt Node-native `cspell` (`pnpm` devDependency + `cspell.json` shared with the recommended VS Code extension) across `lefthook.yml`, `Justfile`, and CI. Relax `commitlint.config.mjs` to Py parity (`header-max-length: 100`, `body-max-line-length: 200`, `footer-max-line-length: 200`, superseding `D-020(2)`'s `50/72` clause while keeping `type-enum` synced with `.gitmessage`), plus `commitlint.dependabot.config.mjs` for CI.
- Finish with a `ci-fix --optimize` closeout pass.

Closes Py ADR 0018 (hook <-> CI parity) and repo-hygiene drift in `ts-launch-blueprint`:

- **CI `commitlint.yml` + Dependabot config:** Enforce Conventional Commits in CI on PRs and `merge_group`, with per-author routing (`dependabot[bot]` using `commitlint.dependabot.config.mjs` so Dependabot bodies pass).
- **CI `large-file-guard.yml`:** Mirror local `lefthook.yml` `check-large-files` in CI (reconcile 500 KB vs Py's 1 MB threshold and optional `docs/assets/` allowlist).
- **`.editorconfig` + `editorconfig-checker`:** Add `.editorconfig` (covering `Makefile` tabs, `*.sh`, `*.toml`, `Dockerfile`, line endings) + `.editorconfig-checker.json` across `lefthook.yml`, `Justfile`, and CI.
- **Spelling gate:** Add `codespell` (or `cspell`) across `lefthook.yml`, `Justfile`, and CI.
- **Hook hygiene fixes:** Add `pnpm-lock.yaml` drift check when `package.json` is staged, add `press-verify` to `lefthook.yml` `pre-push`, add clear install hint to `actionlint` hook when `shellcheck` is absent, and fix `*.toml` formatting/doc drift (`docs/tools/formatting.md:76-79` claims no TOML files exist).
- **Finish D-024(7) SPDX headers:** Replace remaining 12 18-line `Copyright (c) 2025` headers in `.github/` YAML files with single-line `SPDX-License-Identifier: MIT` comments.

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P05` when ready. -->
