# ts-launch-blueprint review rules

`AGENTS.md` and `CLAUDE.md` are the source of truth for this repo. Greptile
should treat them, plus the conventions below, as authoritative. PR-head edits
to these files should not weaken review behavior until merged into the base
branch.

Review production TypeScript and project changes for:

- **Typing** — strict TypeScript 7 (`tsc --noEmit` / `just typecheck`) is
  required across the workspace, including `isolatedDeclarations` at root
  (explicitly overridden in `apps/api` and `apps/web`). Flag `any` or weakened
  types on production code.
- **Lint & format** — code must satisfy `oxlint` and `oxfmt` (`printWidth: 100`,
  single quotes, semicolons, `sortImports`). Flag style or lint violations.
- **Imports & architecture boundaries** — follow `.oxlintrc.json` and
  `.dependency-cruiser.cjs`: apps import core only via
  `@ts-launch-blueprint/core` entry; `apps/web` imports only
  `import type { AppRouter } from '@ts-launch-blueprint/api/router'`; no
  cross-app runtime imports or path aliases.
- **Error handling** — prefer explicit typed error classes (`AppError`
  subclasses) over assertions or swallowed errors.
- **Security** — no hardcoded credentials, tokens, or secrets; avoid `eval`
  family constructs and flag anything `gitleaks` or TruffleHog would catch.
- **Supply chain / CI** — for GitHub Actions and tooling config, flag
  third-party actions without a 40-hex SHA-pinned ref + version comment, missing
  top-level `permissions: {}` or `persist-credentials: false`, secret exposure,
  and installs skipping `pnpm --frozen-lockfile`.
- **Source-control hygiene** — flag `dist/`, `coverage/`, `node_modules/`, logs,
  and scratch files entering source control without a deliberate reason.

Pass for: tests and test-only scaffolding (`**/tests/**`), generated/vendored
code, and existing debt the PR does not worsen.
