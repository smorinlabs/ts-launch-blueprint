# P14 — Audit-triage and pre-push hook hardening

**References**

- **Trunk:** [PROJECTS.md](../PROJECTS.md)
- **Predecessor:** [P04](P04-secret-scanning-and-scheduled-dependency-audits.md)

Adapt muse audit-triage for repository link checks, partial-run resume, diff validation, and multi-ref pre-push gitleaks scanning.

### Scope

- Wire a `docs-linkcheck` job running `node scripts/check-links.mjs README.md docs` into `.github/workflows/dep-audit.yml` (`weekly-audit`) and include it in `file-tracking-issue.needs` so scheduled runs produce real docs-linkcheck findings for `audit-triage.yml`.
- Adapt `.github/scripts/muse_audit_triage.py` without modifying vendored `.github/muse-audit-triage/runtime.py` (preserving `.github/muse-audit-triage/NOTICE`):
  - Parse both Sphinx linkcheck and `scripts/check-links.mjs` broken-link lines and extract finding files/targets.
  - Validate the checkout via `validate_triage_tree` allowing only a root tracked `.npmrc` with non-secret pnpm/npm configuration (rejecting auth/token/secret/nested/untracked `.npmrc`).
  - Support partial-run resume (`prepare_resume` -> `resume_mode=create_pr|finish`) with bot commit/PR ownership and docs-only scope checks, wired into `.github/workflows/audit-triage.yml`.
  - Validate the staged `docs/` diff in `validate` so unrelated edits that do not address any broken-link finding are rejected.
- Parse Git `pre-push` stdin `<local_ref> <local_oid> <remote_ref> <remote_oid>` tuples in `scripts/check-gitleaks.sh --range` (enabling `use_stdin: true` in `lefthook.yml`) so multi-ref and non-`HEAD` pushes scan every pushed range accurately while keeping standalone `--range` CLI fallback intact.
- Add `.contributors.jsonl` to `press/press-rules.toml` `[[remove]]` alongside `.contributors.yml` and `CONTRIBUTORS.md`.

### Out of scope

- Modifying vendored `.github/muse-audit-triage/runtime.py` (must remain unchanged per `NOTICE`).
- Auto-remediating dependency vulnerability updates inside `audit-triage.yml` (stays strictly docs-only).

### Decisions

- **Safe `.npmrc` wrapper in `muse_audit_triage.py`:** Keep vendored `runtime.py` byte-for-byte untouched and enforce the root non-secret `.npmrc` allowlist strictly inside `muse_audit_triage.py:validate_triage_tree` while keeping `.npmrc` denied to the model's tool profile.
- **Backward-compatible `--range` stdin parsing:** `scripts/check-gitleaks.sh --range` consumes valid pre-push tuples when piped via stdin (`lefthook.yml` `use_stdin: true`) and falls back to `@{u}..HEAD` / `origin/main..HEAD` when invoked interactively or with empty stdin.

### Tests & Tasks

- [x] [P14-TS01] Add POSIX unit tests in `tests/gitleaks-scripts.test.ts` covering multi-ref `pre-push` stdin scanning (non-`HEAD` ref update, new branch, deleted ref skip, and failure on leaked ref) plus `lefthook.yml` `use_stdin: true` assertion in `tests/repo-hygiene.test.ts`.
- [x] [P14-TS02] Add tests in `tests/audit-triage.test.ts` and `tests/repo-hygiene.test.ts` covering `dep-audit.yml` `docs-linkcheck` job, `scripts/check-links.mjs` broken-link extraction, safe vs secret `.npmrc` validation (`validate_triage_tree`), staged diff finding validation (`diff_addresses_findings`), and partial-run resume ownership checks (`create_pr`, `finish`, completed-PR refusal, foreign-PR refusal).
- [x] [P14-T01] Implement multi-ref `pre-push` stdin parsing in `scripts/check-gitleaks.sh` and enable `use_stdin: true` on `pre-push` `gitleaks-range` in `lefthook.yml`.
- [x] [P14-T02] Add `docs-linkcheck` job to `.github/workflows/dep-audit.yml` and implement `check-links.mjs` parsing, `validate_triage_tree`, `diff_addresses_findings`, and `prepare_resume` in `.github/scripts/muse_audit_triage.py` + `.github/workflows/audit-triage.yml`.
- [x] [P14-T03] Add `.contributors.jsonl` removal rule to `press/press-rules.toml` and verify `just all`, `just coverage`, `just pack-check`, `just docs-check`, `just press-verify`, and `project-audit --all`.
