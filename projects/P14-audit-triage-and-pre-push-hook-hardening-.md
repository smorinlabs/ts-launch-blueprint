# P14 — Audit-triage and pre-push hook hardening

Adapt muse audit-triage for dependency audits, partial-run resume, and multi-ref pre-push scanning.

### Notes

Deferred follow-ups from P04 PR #84 review (`coderabbitai[bot]`):

- **Muse audit-triage workflow adaptation (`T3`, `T4`):** `ts-launch-blueprint`'s `weekly-audit` runs `pnpm-audit` and `osv-scanner` (not `docs-linkcheck`), and the repo's tracked non-secret `.npmrc` triggers vendored `runtime.py` `sensitive()`. Adapt `muse_audit_triage.py` (or wire a separate docs-linkcheck producer / upstream `runtime.py` `.npmrc` policy) without breaking the docs-only lockdown or `NOTICE` vendoring contract.
- **Muse audit-triage publication & diff validation (`T1`, `T5`):** Support resuming mid-publication after partial failures (push succeeded without PR, or PR created without verification table) with ownership checks, and validate that the staged `docs/` diff addresses broken-link findings.
- **Multi-ref `pre-push` gitleaks range scanning (`T13`):** Parse Git `pre-push` stdin `<local_ref> <local_oid> <remote_ref> <remote_oid>` tuples in `scripts/check-gitleaks.sh` / `lefthook.yml` so pushing a branch other than `HEAD` scans each pushed ref range accurately.

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P14` when ready. -->
