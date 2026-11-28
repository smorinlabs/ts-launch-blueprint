# Security Policy

## Supported Versions

Pre-1.0 security fixes ship as `0.x` releases on the latest minor/patch line.

| Version | Supported          |
| ------- | ------------------ |
| 0.x     | :white_check_mark: |
| < 0.1   | :x:                |

## Scope

`ts-launch-blueprint` is a TypeScript monorepo project template. In scope:

- The template's own code (`packages/core/`, `apps/cli/`, `apps/api/`, `apps/web/`)
- The template rebranding and setup scripts (`press/`, `scripts/`)
- The GitHub Actions workflows and release pipeline in this repository

If you maintain a repository stamped from this template and find a flaw it
inherited from the template, please report it here so the fix reaches every
stamped project. Vulnerabilities in code you added to your own repository are
out of scope.

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.

1. **Preferred:** use GitHub's
   [private vulnerability reporting](https://github.com/smorinlabs/ts-launch-blueprint/security/advisories/new).
2. **Fallback:** if you cannot use GitHub, email
   [steve.morin@gmail.com](mailto:steve.morin@gmail.com).

Include the affected version or commit, the steps to reproduce, and the
impact you expect.

Automated and AI-generated reports are welcome when they include a working
reproduction or proof of concept. Reports without one may be closed.

## What to Expect

- **Acknowledgment:** within 7 days, on a best-effort basis.
- **Investigation and fix:** we confirm the issue, develop a fix, and release
  it as a `0.x` update.
- **Disclosure:** we publish a GitHub Security Advisory, requesting a CVE when
  warranted, once the fix is released, or 90 days after the report at most.
  Reporters are credited unless they ask not to be.

## Security Controls

- **Code scanning:** CodeQL (`javascript-typescript`) with the
  `security-extended` queries (`.github/workflows/codeql.yml` and
  `.github/codeql/codeql-config.yml`)
- **Dependency auditing:** weekly `pnpm audit --audit-level=high` and
  OSV-Scanner over the locked workspace graph (`.github/workflows/dep-audit.yml`),
  dependency review on pull requests (`.github/workflows/dependency-review.yml`),
  and manual environment-gated OSV-Scanner PR reviews
  (`.github/workflows/manual-pr-security-scan.yml`)
- **Dependency updates:** Dependabot alerts and grouped weekly updates for
  `github-actions`, `npm`, and `docker` (`.github/dependabot.yml`)
- **Secret scanning:** TruffleHog (`--only-verified`) in CI
  (`.github/workflows/secret-scan.yml`) and `gitleaks` pattern scanning in the
  pre-commit and pre-push hooks (`lefthook.yml`)
- **Branch protection:** `main` requires passing status checks (`ci-ok`,
  `press-verify`, `commitlint (humans)`) before merge

## Code Scanning Setup

This project ships **advanced** CodeQL setup: the analysis is configured in
`.github/workflows/codeql.yml` and `.github/codeql/codeql-config.yml`, kept in
version control so it is reviewed in pull requests and inherited by forks.

Because of this, GitHub's **default setup** for code scanning must stay
**disabled**. Enabling both makes the workflow fail at upload with
`CodeQL analyses from advanced configurations cannot be processed when the
default setup is enabled`. To check or disable default setup on your repo
(requires admin):

```bash
# check current state
gh api /repos/<OWNER>/<REPO>/code-scanning/default-setup

# disable it, handing control to the committed workflow
gh api --method PATCH /repos/<OWNER>/<REPO>/code-scanning/default-setup \
  -f state=not-configured
```
