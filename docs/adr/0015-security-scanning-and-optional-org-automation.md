# 0015. Two-layer secret scanning, CodeQL, OSV-Scanner, and optional org triage

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`Q11.C`, `D-022`)
- **Related:** `.github/SECURITY.md`, `.gitleaks.toml`, `.github/workflows/codeql.yml`, `.github/workflows/dep-audit.yml`

## Context

Security regressions must be caught both before push (secrets) and across PRs
and scheduled runs (code patterns and dependencies), without requiring paid
third-party SaaS API keys for downstream forks.

## Decision

We will ship a **keyless-by-default layered security posture**:

- **Two-layer secret scanning:** `gitleaks` locally (`pre-commit` / `pre-push`
  range check) paired with TruffleHog `--only-verified` in CI (`secret-scan.yml`).
- **Code & dependency scanning:** Advanced CodeQL (`javascript-typescript`,
  `security-extended`), `dependency-review.yml` on public PRs, weekly
  `dep-audit.yml` (`pnpm audit` + `osv-scanner`), and manual environment-gated
  keyless `google/osv-scanner-action` (`manual-pr-security-scan.yml`, env
  `security-review`).
- **Optional org automation (`Q11.C`):** Weekly Muse `audit-triage.yml` is
  gated on `vars.MUSE_CI_ENABLED == 'true'` + `META_MUSE_CI_API_KEY`, and
  `.oss-scanner/` container/threat-model assets remain blueprint-only
  (`[[remove]]`d on `press rebrand`).

## Consequences

- Downstream repositories get complete secret, SAST, and SCA coverage with zero
  required third-party secrets.
- Every workflow uses `permissions: {}` baseline with least-privilege job
  grants and `persist-credentials: false` on checkouts.

## Alternatives considered

- **Require Safety / paid scanner API keys in forked repos** — fails on fresh
  forks until manual secrets are provisioned.
