# P04 — Secret scanning and scheduled dependency audits

**References**

- **Trunk:** [PROJECTS.md](../PROJECTS.md)
- **Design:** [TS_PORT_DECISIONS.md](../docs/port/TS_PORT_DECISIONS.md)

Add gitleaks, TruffleHog CI, weekly dep-audit, canary, and CodeQL/Dependabot

### Scope

- Local `gitleaks`: add `.gitleaks.toml`, `.gitleaksignore`, checksum-verified `scripts/install-gitleaks.sh`, `scripts/check-gitleaks.sh` (`--staged` and `--range` with `origin/HEAD`/`origin/main` fallback), `Justfile` `install-gitleaks`/`check-gitleaks` recipes, and `lefthook.yml` `pre-commit` + `pre-push` hooks.
- CI secret scan: add `.github/workflows/secret-scan.yml` running SHA-pinned `trufflesecurity/trufflehog` (`--only-verified`) on PR diffs and full-history pushes.
- Local & scheduled CVE audit: add `just audit` (`pnpm audit --audit-level=high`) and `.github/workflows/dep-audit.yml` (weekly schedule + `workflow_dispatch`) running both `pnpm audit --audit-level=high` and `osv-scanner` and filing/updating a rolling GitHub tracking issue on scheduled failure.
- Weekly dependency canary: add `.github/workflows/canary.yml` resolving fresh transitive dependencies weekly (`pnpm update` / non-frozen install) against Node `24.x` + `26.x`.
- CodeQL depth & Dependabot hardening: add `.github/codeql/codeql-config.yml` (`queries: security-extended`, ignore `**/tests/**` and `docs/**`) wired into `.github/workflows/codeql.yml`, and harden `.github/dependabot.yml` (`cooldown: default-days: 5`, `open-pull-requests-limit`, `labels`, `commit-message` conventional prefix/scope, finer dependency groups).
- Automated Muse audit triage: add `.github/workflows/audit-triage.yml`, `.github/scripts/muse_audit_triage.py`, and `.github/muse-audit-triage/` gated on `vars.MUSE_CI_ENABLED == 'true'`, org ownership, and `META_MUSE_CI_API_KEY` (`Q11.C`).
- Complete mandatory `ci-fix --optimize` closeout on the measured green PR CI run.

### Out of scope

- Changing GitHub repository variables or secrets (`vars.MUSE_CI_ENABLED`, `META_MUSE_CI_API_KEY` remain as currently configured).
- External docs link checking in `dep-audit.yml` (offline `just docs-check` stays in `ci.yml`).

### Decisions

- **Weekly `dep-audit.yml` scope:** Run both `pnpm audit --audit-level=high` and `osv-scanner` on the weekly schedule (with rolling tracking issue on scheduled failure); external docs link checking is excluded.
- **Q11.C (Muse audit triage):** Include automated Muse audit triage (`.github/workflows/audit-triage.yml`, `.github/scripts/muse_audit_triage.py`, `.github/muse-audit-triage/`), gated on `vars.MUSE_CI_ENABLED == 'true'`, org ownership, and `META_MUSE_CI_API_KEY`.
- **Closeout:** Mandatory `ci-fix --optimize` pass on the measured green PR CI run before merge.

### Tests & Tasks

- [x] [P04-TS01] Add/update `tests/repo-hygiene.test.ts` (and dedicated security/audit-triage tests) verifying SHA-pinned third-party actions and top-level `permissions:` on `secret-scan.yml`, `dep-audit.yml`, `canary.yml`, and `audit-triage.yml`, `.github/codeql/codeql-config.yml`, `.github/dependabot.yml` hardening fields, and `muse_audit_triage.py`/policy gates.
- [x] [P04-TS02] Add tests covering `scripts/check-gitleaks.sh` (`--staged`/`--range` handling) and `scripts/install-gitleaks.sh` checksum verification.
- [x] [P04-T01] Add `.gitleaks.toml`, `.gitleaksignore`, `scripts/install-gitleaks.sh`, `scripts/check-gitleaks.sh`, `Justfile` `install-gitleaks`/`check-gitleaks` recipes, and `lefthook.yml` `pre-commit`/`pre-push` hooks.
- [x] [P04-T02] Add `.github/workflows/secret-scan.yml` (SHA-pinned TruffleHog `--only-verified`), `just audit`, `.github/workflows/dep-audit.yml`, and `.github/workflows/canary.yml`.
- [x] [P04-T03] Add `.github/codeql/codeql-config.yml` (wired into `codeql.yml`), harden `.github/dependabot.yml`, and add `.github/workflows/audit-triage.yml`, `.github/scripts/muse_audit_triage.py`, and `.github/muse-audit-triage/`.
- [x] [P04-T04] Run `just all`, `just coverage`, `just pack-check`, `just docs-check`, and `project-audit P04`; open PR, run `ci-fix --optimize` closeout on green CI, resolve review threads, mark `P04` `[x]`, and merge via `--merge`.
