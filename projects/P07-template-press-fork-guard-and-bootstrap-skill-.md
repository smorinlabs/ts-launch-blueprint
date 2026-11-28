# P07 — Template-press fork guard and bootstrap skill

Add guard.sh, CI bootstrap acceptance, press cleanups, and new-ts-project skill

### Open questions

- Which `Justfile` recipes should carry the Tier 2 `_guard` hard block (`build`, `docker-build`, `pack-check`, others)?
- Should `new-ts-project` live in `.claude/skills/new-ts-project/` with an `.agents/skills/new-ts-project` symlink (mirroring Py's `new-python-project`) and be retired on press?
- Wait on `P01` (`template-press==5.0.0` PyPI switch) first so the bootstrap skill and `bootstrap-acceptance.yml` pin PyPI `5.0.0` directly rather than a git commit SHA?

### Notes

Brings `ts-launch-blueprint`'s template-press lifecycle to full parity with Py `P06`–`P07`:

- **Blueprint setup guard (`scripts/guard.sh`):** Add POSIX two-tier guard — Tier 1 eager `Justfile` discovery warning (`_blueprint_notice`) and Tier 2 private `_guard` hard block on risk recipes, skipped when `press/press-receipt.toml` exists, `.blueprint-contributor` exists (gitignored), or origin is `smorinlabs/ts-launch-blueprint` — plus `tests/guard.test.ts`. Note `.github/workflows/template-receipt-guard.yml` already mentions this guard in its header comment.
- **CI bootstrap acceptance (`.github/workflows/bootstrap-acceptance.yml`):** Wire existing `tests/press-acceptance.test.ts` (`PRESS_ACCEPTANCE=1`, currently manual-only) into a path-filtered PR + weekly cron workflow (skipping release-please PRs) that stamps a child repo and runs full setup, checks, build, and API smoke tests.
- **`press/press-rules.toml` completeness:** Add `[[clean]]` declarations for stale build outputs and add a `[[reset]]` stub (`press/stubs/security.md`) for `.github/SECURITY.md` so children do not inherit template-scoped security claims.
- **Agent bootstrap skill (`new-ts-project`):** Create `.claude/skills/new-ts-project/{SKILL.md,README.md}` + `.agents/skills/new-ts-project` symlink + `docs/skills/new-ts-project.md` + metadata contract test (Codex `<=1024`-char description) + press retirement rules.

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P07` when ready. -->
