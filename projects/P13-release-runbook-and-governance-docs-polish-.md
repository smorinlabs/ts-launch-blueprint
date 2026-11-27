# P13 — Release runbook and governance docs polish

Add PROJECT_SETUP, full RELEASE guide, ADRs, SECURITY/OSS kit, logos and badges

### Open questions

- Which workspace packages should publish to npm when unpausing `D-045` (`apps/cli` only, `packages/core` + `apps/cli`, or template-only)?
- Should `ts-launch-blueprint` also enroll in Anthropic OSS Scanner (`.oss-scanner/Dockerfile`, `threat_model.md`, matching Py `P09`)?
- Keep stock `googleapis/release-please-action` (`D-021(1)`) or port Py's custom Bun release runner (`scripts/release_please.cjs`) for local `RELEASE_PLEASE_APPLY=0` previews?

### Notes

Closes remaining documentation, release-ops, governance, and brand maturity gaps vs Py `v4.2.0`:

- **Post-init & release runbooks:**
  - Add comprehensive `docs/PROJECT_SETUP.md` + `docs/POST_INIT.md` (feature keep/drop matrix, GitHub Secrets/Environments tables, `gh api` commands for CodeQL default-setup-OFF, Actions PR permissions, branch protection, merge strategy).
  - Replace the `**Stub**` `docs/maintainers-release.md` with a complete `docs/RELEASE.md` (npm OIDC, GHCR, GitHub App token setup, disabling release-please, first-release cutover, recovery) and add `scripts/setup-github-environments.sh` + `scripts/setup-npm-publishing.sh`.
  - Revisit `D-045` (re-enable `v*` trigger on `publish.yml`, add `concurrency`, cut V1 release).
- **Retained ADR & design-decisions docs:** Add `docs/adr/` (`README.md`, `template.md`, initial ADRs) and `docs/about/design-decisions.md` so pressed child repos inherit an ADR framework after `docs/port/` is removed.
- **Security & contributors fixes:**
  - Upgrade `.github/SECURITY.md` (accurate version table, template-vs-child scope, fallback email, AI/PoC policy, CodeQL default-setup disable instructions; paired with `press/stubs/security.md` in `P07`) and optionally add `.oss-scanner/{Dockerfile,threat_model.md}`.
  - Fix `.github/workflows/update-contributors.yml` (`push: main` trigger, explicit `commit-message` without `[skip ci]` deadlock) and expand `.contributors.yml` (bot ignore list, categories, `identity_map`).
- **Repair broken/drifted community & brand files:**
  - Repair truncated `.github/CONTRIBUTING.md` (lines 91–93 omit the commit format/types/examples).
  - Add missing `alternatives` (`01-feature-request.yml`) and `pre-filing-verification` (`03-bug-report.yml`) fields; refresh drifted `pull_request_template.md`, `docs/tools/github-actions.md`, `docs/tasks/using-ci-cd.md`, and `docs/tutorials/full-project-setup.md`; drop dead `publish.yml` ignore in `.github/actionlint.yaml`.
  - Replace `assets/images/logos/PLACEHOLDER.md` with TS logo artwork and expand `README.md` badges (npm, Node, Codecov, Oxc, pnpm, Conventional Commits).

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P13` when ready. -->
