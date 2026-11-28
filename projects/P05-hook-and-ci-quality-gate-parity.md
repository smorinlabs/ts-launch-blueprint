# P05 — Hook and CI quality gate parity

**References**

- **Trunk:** [PROJECTS.md](../PROJECTS.md)
- **Design:** [TS_PORT_DECISIONS.md](../docs/port/TS_PORT_DECISIONS.md)

Mirror commitlint, large-file, codespell, EditorConfig, and lockfile/TOML gates

### Scope

- CI `commitlint.yml` + `commitlint.dependabot.config.mjs`: enforce Conventional Commits on PRs and `merge_group` with per-author routing for `dependabot[bot]`; relax `commitlint.config.mjs` to `header-max-length: 100`, `body-max-line-length: 200`, `footer-max-line-length: 200` while keeping `type-enum` synced with `.gitmessage` (`Q9.A`).
- CI `large-file-guard.yml`: mirror local `lefthook.yml` `check-large-files` in CI (reconcile size threshold and optional `docs/assets/` allowlist).
- `.editorconfig` + `.editorconfig-checker.json` (`editorconfig-checker`) across `lefthook.yml`, `Justfile`, and CI.
- Node-native `cspell` (`pnpm` devDependency + `cspell.json` shared with `.vscode/extensions.json`) across `lefthook.yml`, `Justfile`, and CI (`Q9.A`).
- Hook hygiene fixes: `pnpm-lock.yaml` pre-commit drift check when `package.json` is staged, `press-verify` in `lefthook.yml` `pre-push`, clear install hint in `actionlint` hook when `shellcheck` is absent, and `oxfmt` TOML formatting (`*.toml` in `lefthook.yml`) + `docs/tools/formatting.md` fix.
- Replace the remaining 12 18-line MIT license headers in `.github/` YAML files with single-line `# SPDX-License-Identifier: MIT` comments (`D-024(7)`).
- Update `tests/repo-hygiene.test.ts` (relaxing `50/72` assertion to `100/200/200` and validating the new workflows/SPDX headers).
- Complete mandatory `ci-fix --optimize` closeout on the measured green PR CI run.

### Out of scope

- Adopting `taplo` or `.taplo.toml` (`oxfmt` `0.70.0` handles TOML natively).
- Adopting `yamllint` (`oxfmt` handles YAML formatting and `actionlint` validates GitHub workflows).
- Adopting Python `codespell` (superseded by Node-native `cspell` per `Q9.A`).

### Decisions

- **Q9.A (`cspell` & `commitlint`):** Adopt Node-native `cspell` (`pnpm` devDependency + `cspell.json` shared with the recommended VS Code extension) across `lefthook.yml`, `Justfile`, and CI. Relax `commitlint.config.mjs` to `header-max-length: 100`, `body-max-line-length: 200`, `footer-max-line-length: 200` (superseding `D-020(2)`'s `50/72` clause while keeping `type-enum` synced with `.gitmessage`) and add `commitlint.dependabot.config.mjs` for CI.
- **TOML & YAML tooling:** Neither `taplo` nor `yamllint` is needed because `oxfmt` `0.70.0` natively formats `.toml` and `.yml`/`.yaml`, and `actionlint` validates workflows. Enable `*.toml` formatting in `lefthook.yml` and update `docs/tools/formatting.md:76-79`.
- **D-024(7) SPDX headers:** Replace the 12 remaining 18-line MIT headers in `.github/` YAML files with `# SPDX-License-Identifier: MIT`.
- **Closeout:** Mandatory `ci-fix --optimize` pass on the measured green PR CI run before merge.

### Tests & Tasks

- [ ] [P05-TS01] Update `tests/repo-hygiene.test.ts` for relaxed `commitlint.config.mjs` (`100/200/200` + synced `type-enum`), `commitlint.dependabot.config.mjs`, zero 18-line MIT headers in `.github/`, and permissions/SHA-pin invariants on `commitlint.yml`, `large-file-guard.yml`, and EditorConfig/`cspell` CI steps.
- [ ] [P05-T01] Relax `commitlint.config.mjs` to `100/200/200`, add `commitlint.dependabot.config.mjs`, and add `.github/workflows/commitlint.yml` and `.github/workflows/large-file-guard.yml`.
- [ ] [P05-T02] Add `.editorconfig`, `.editorconfig-checker.json`, and Node-native `cspell` (`pnpm` devDependency, `cspell.json`, `.vscode/extensions.json`), and wire both into `Justfile`, `lefthook.yml`, and CI.
- [ ] [P05-T03] Add `pnpm-lock.yaml` pre-commit drift check, `press-verify` pre-push hook, `actionlint` missing-binary hint, and `oxfmt` `*.toml` glob in `lefthook.yml`, and fix `docs/tools/formatting.md`.
- [ ] [P05-T04] Replace the 12 remaining 18-line MIT headers in `.github/` YAML files with `# SPDX-License-Identifier: MIT`.
- [ ] [P05-T05] Run `just all`, `just coverage`, `just pack-check`, `just docs-check`, and `project-audit P05`; open PR, run `ci-fix --optimize` closeout on green CI, resolve review threads, mark `P05` `[x]`, and merge via `--merge`.
