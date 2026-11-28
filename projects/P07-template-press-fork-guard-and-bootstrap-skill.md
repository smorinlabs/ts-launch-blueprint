# P07 — Template-press fork guard and bootstrap skill

**References**

- **Trunk:** [PROJECTS.md](../PROJECTS.md)
- **Design:** [TS_PORT_DECISIONS.md](../docs/port/TS_PORT_DECISIONS.md)
- **Depends on:** P06

Add guard.sh, CI bootstrap acceptance, press cleanups, and new-ts-project skill

### Scope

- **Blueprint setup guard (`scripts/guard.sh`):** Port POSIX bash two-tier guard (`warn` eager Tier 1 stderr banner always exiting `0`; `block` Tier 2 stderr box exiting `1`; unknown mode exiting `2`), skipped when `press/press-receipt.toml` exists, `.blueprint-contributor` exists (gitignored in `.gitignore`), or `git remote get-url origin` normalizes to `smorinlabs/ts-launch-blueprint` or `smorin/ts-launch-blueprint`. Wire `_blueprint_notice := shell('bash scripts/guard.sh warn')` and `[private] @_guard: bash scripts/guard.sh block` into `Justfile` (`build`, `docker-build`, `pack-check`), plus `tests/guard.test.ts`.
- **CI bootstrap acceptance (`.github/workflows/bootstrap-acceptance.yml`):** Wire `tests/press-acceptance.test.ts` (`PRESS_ACCEPTANCE=1`) into a path-filtered PR + `workflow_dispatch` + weekly cron workflow (skipping same-repo `release-please--*` PRs) that runs `just setup` and live press acceptance, and extend `tests/press-acceptance.test.ts` to cover `just setup`, `[[clean]]`, `.github/SECURITY.md` stub reset, `new-ts-project` retirement, `apps/web` build, and live `apps/api` HTTP smoke (`scripts/smoke-api.sh` on an ephemeral free port).
- **`press/press-rules.toml` completeness & stubs:** Add `[[clean]]` declarations for ignored build/coverage outputs (`apps/*/dist`, `packages/*/dist`, `coverage`), add `press/stubs/security.md` (TS-adapted private reporting + advanced CodeQL `.github/workflows/codeql.yml` / `.github/codeql/codeql-config.yml` guidance) with `[[reset]]` for `.github/SECURITY.md`, add `press/stubs/retired-bootstrap.md` and `press/stubs/bootstrap-provenance.md`, and declare `[[remove]]` / `[[reset]]` / `extra_exclude_files` rules for `new-ts-project`, `tests/bootstrap-skill.test.ts`, and `bootstrap-acceptance.yml` (with zero source identity tokens in any stub or control comment).
- **Agent bootstrap skill (`new-ts-project`):** Ship `.claude/skills/new-ts-project/{SKILL.md,README.md}` (collecting all 8 `[identity]` fields including `cli_name` and running `make bootstrap` + `just setup` + `oxfmt` + quality/smoke gates), committed `.agents/skills/new-ts-project` directory symlink, `docs/skills/new-ts-project.md`, and `tests/bootstrap-skill.test.ts` (Codex `<=1024`-char description + symlink + press-retirement contract).
- Complete mandatory `ci-fix --optimize` closeout on the measured green PR CI run.

### Out of scope

- Blocking non-artifact recipes (`setup`, `install`, `all`, `test`, `lint`, `typecheck`, `check-deps`, `debug-info`, `press-verify`, `clean`) with `_guard`.
- Removing `scripts/guard.sh` or `tests/guard.test.ts` on `press rebrand` (both ship to pressed child repos so `Justfile` stays intact while `press/press-receipt.toml` silences the guard; un-pressed blueprint forks remain guarded).
- Creating `docs/PROJECT_SETUP.md` or `docs/POST_INIT.md` (deferred to `P13`; P07 links only to existing `docs/tutorials/full-project-setup.md` and `press/press-receipt.toml`).

### Decisions

- **Tier 2 `_guard` recipes:** Attach `_guard` to identity/artifact-producing recipes `build`, `docker-build`, and `pack-check` only, keeping `setup`, `install`, `all`, `test`, `lint`, `typecheck`, `check-deps`, `debug-info`, `press-verify`, and `clean` unblocked alongside Tier 1 eager `_blueprint_notice`.
- **`new-ts-project` skill placement & retirement:** Place the skill in `.claude/skills/new-ts-project/{SKILL.md,README.md}` with a committed `.agents/skills/new-ts-project` directory symlink and `docs/skills/new-ts-project.md`. On `press rebrand`, `[[remove]]` `SKILL.md` + `tests/bootstrap-skill.test.ts` and `[[reset]]` `README.md` (`press/stubs/retired-bootstrap.md`) and `docs/skills/new-ts-project.md` (`press/stubs/bootstrap-provenance.md`), linking only to existing `docs/tutorials/full-project-setup.md` (`../tutorials/full-project-setup.md`) and `press/press-receipt.toml` so `just docs-check` passes both pre- and post-press.
- **P01 & P06 sequencing:** `P01` (`template-press==5.0.0` PyPI switch) already merged in PR #82, so `SKILL.md`, `guard.sh`, and `bootstrap-acceptance.yml` pin PyPI `template-press==5.0.0` directly via `uvx`. Launch `P07` once `P06` merges so `guard.sh`, `bootstrap-acceptance.yml`, and `new-ts-project` integrate cleanly with `make bootstrap` and `just setup`.
- **Closeout:** Mandatory `ci-fix --optimize` pass on the measured green PR CI run (tuning `bootstrap-acceptance.yml` caching/speed) before `--merge`.

### Tests & Tasks

- [x] [P07-TS01] Add `tests/guard.test.ts` (`describe.skipIf(process.platform === 'win32')`) testing `scripts/guard.sh` `warn` (exit 0 + stderr banner), `block` (exit 1 + stderr box), unknown mode (exit 2), and all 3 skip conditions (`press/press-receipt.toml`, `.blueprint-contributor`, and canonical `smorinlabs/ts-launch-blueprint` / `smorin/ts-launch-blueprint` origins vs non-canonical fork origins and unrelated `press/*.md`).
- [x] [P07-TS02] Add `tests/bootstrap-skill.test.ts` asserting `.claude/skills/new-ts-project/SKILL.md` YAML frontmatter (`name === 'new-ts-project'`, `description.length <= 1024`, 8-key identity contract), `.agents/skills/new-ts-project` symlink resolution, and `press/press-rules.toml` retirement entries; extend `tests/press-config.test.ts` / `tests/repo-hygiene.test.ts` for `[[clean]]`, `press/stubs/security.md` (zero source identity tokens), `Justfile` `_blueprint_notice`/`_guard`, and `.github/workflows/bootstrap-acceptance.yml` invariants (top-level `permissions: {}`, SHA-pinned actions, `release-please--*` skip, path filters).
- [x] [P07-TS03] Extend `tests/press-acceptance.test.ts` to run `just setup`, assert `[[clean]]`, `.github/SECURITY.md` stub reset, and `new-ts-project` retirement (`SKILL.md` removed, `README.md`/`docs/skills/new-ts-project.md` reset, `.agents/skills/new-ts-project/README.md` resolvable), build `apps/web` (`just build`), and run the live `apps/api` HTTP smoke test (`scripts/smoke-api.sh` on an ephemeral free port).
- [x] [P07-T01] Port `scripts/guard.sh` (`chmod +x`, ShellCheck-clean, referencing `uvx --from template-press==5.0.0 press rebrand` and `docs/tutorials/full-project-setup.md`), add `.blueprint-contributor` to `.gitignore`, and wire `_blueprint_notice` and `_guard` (`build`, `docker-build`, `pack-check`) into `Justfile`.
- [x] [P07-T02] Update `press/press-rules.toml` with `[[clean]]`, `press/stubs/security.md` (`[[reset]]` for `.github/SECURITY.md`), `press/stubs/retired-bootstrap.md`, `press/stubs/bootstrap-provenance.md`, and `[[remove]]`/`[[reset]]`/`extra_exclude_files` rules for `new-ts-project`, `tests/bootstrap-skill.test.ts`, and `bootstrap-acceptance.yml` (with zero source identity tokens in stubs/comments).
- [x] [P07-T03] Add `.github/workflows/bootstrap-acceptance.yml` running `just setup` and `PRESS_ACCEPTANCE=1 pnpm exec vitest run tests/press-acceptance.test.ts` on PR path filters, `workflow_dispatch`, and weekly cron (skipping same-repo `release-please--*` PRs).
- [x] [P07-T04] Add `.claude/skills/new-ts-project/{SKILL.md,README.md}`, committed `.agents/skills/new-ts-project` directory symlink, and `docs/skills/new-ts-project.md` (linking only to existing docs so `just docs-check` passes), plus `cspell.json` additions if needed.
- [ ] [P07-T05] Run `just all`, `just coverage`, `just pack-check`, `just docs-check`, `just press-verify`, `PRESS_ACCEPTANCE=1 pnpm exec vitest run tests/press-acceptance.test.ts`, and `project-audit P07`; open PR, run `ci-fix --optimize` closeout on green CI, resolve review threads, mark `P07` `[x]`, and merge via `--merge`.
