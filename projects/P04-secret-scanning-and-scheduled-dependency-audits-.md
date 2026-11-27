# P04 — Secret scanning and scheduled dependency audits

Add gitleaks, TruffleHog CI, weekly dep-audit, canary, and CodeQL/Dependabot

### Open questions

- Should `dep-audit.yml` run `pnpm audit --audit-level=high`, `osv-scanner`, or both on the weekly schedule, and should it also check external docs links like Py's `weekly-audit`?
- Should automated Muse audit triage (`audit-triage.yml`, `.github/scripts/muse_audit_triage.py`, `.github/muse-audit-triage/`) be included here, deferred to `P13`, or kept Py-only?

### Notes

Ports Py's two-layer secret scanning (ADR-02), scheduled vulnerability monitoring (`dep-audit.yml`, `canary.yml`), and CodeQL/Dependabot hardening:

- **Local `gitleaks`:** Add `.gitleaks.toml`, `.gitleaksignore`, checksum-verified `scripts/install-gitleaks.sh`, `scripts/check-gitleaks.sh` (`--staged` and `--range` with `origin/HEAD`/`origin/main` fallback), `Justfile` `install-gitleaks`/`check-gitleaks`, and `lefthook.yml` `pre-commit` + `pre-push` hooks.
- **CI secret scan:** Add `.github/workflows/secret-scan.yml` running SHA-pinned `trufflesecurity/trufflehog` (`--only-verified`) on PR diffs and full-history pushes.
- **Local & scheduled CVE audit:** Add `just audit` (`pnpm audit --audit-level=high`) and `.github/workflows/dep-audit.yml` (weekly schedule + `workflow_dispatch`) that auto-files/updates a rolling GitHub tracking issue on scheduled failure.
- **Weekly dependency canary:** Add `.github/workflows/canary.yml` resolving fresh transitive dependencies weekly (`pnpm update` / non-frozen install) against Node `24.x` + `26.x` to catch upstream breakage early.
- **CodeQL depth:** Add `.github/codeql/codeql-config.yml` enabling `queries: security-extended` and ignoring `**/tests/**` and `docs/**`.
- **Dependabot hardening:** Add `cooldown: default-days: 5`, `open-pull-requests-limit`, labels, `commit-message` conventional prefix/scope, and finer dependency groups to `.github/dependabot.yml`.

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P04` when ready. -->
