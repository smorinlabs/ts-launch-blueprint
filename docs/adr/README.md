# Architecture Decision Records (ADRs)

An ADR captures **one architecturally significant decision** — the context, the
choice, and its consequences — so it is not silently re-litigated later.

## Conventions

- **Filename:** `NNNN-kebab-title.md` (zero-padded, sequential), e.g.
  `0001-pnpm-monorepo-and-cli-only-publishing.md`.
- **Status:** `Proposed` → `Accepted` → (`Superseded by NNNN` | `Deprecated`).
- **One decision per file.** Keep it concise; link to the design doc or
  configuration that implements it.
- **Immutable once Accepted.** To change a decision, write a new ADR that
  supersedes it (and update the old one's status) rather than rewriting history.

Start from [`template.md`](template.md).

## Index

| ADR                                                            | Title                                                                    | Status   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ | -------- |
| [0001](0001-pnpm-monorepo-and-cli-only-publishing.md)          | pnpm workspace monorepo and CLI-only npm publishing                      | Accepted |
| [0002](0002-no-secrets-in-config-file.md)                      | Secrets are never stored in the config file                              | Accepted |
| [0003](0003-noun-verb-cli-and-global-output-formats.md)        | Noun-verb CLI surface and global output formats                          | Accepted |
| [0004](0004-config-errors-degrade-to-warnings.md)              | Discovered config errors degrade to warnings                             | Accepted |
| [0005](0005-turnkey-toolchains-mise-flox-devcontainer.md)      | Turnkey toolchains (mise, flox, DevContainer) with Makefile + Justfile   | Accepted |
| [0006](0006-stable-error-codes-hints-crash-log.md)             | Unified ConfigError, stable error codes, hints, and crash log            | Accepted |
| [0007](0007-cli-ergonomics-pager-onboarding-doctor.md)         | CLI ergonomics: pager, guided init, onboarding marker, and doctor bundle | Accepted |
| [0008](0008-windows-native-paths-xdg-overrides.md)             | Windows-native default directories with XDG overrides everywhere         | Accepted |
| [0009](0009-layered-core-and-boundary-enforcement.md)          | Layered core architecture with mechanical boundary enforcement           | Accepted |
| [0010](0010-typescript-7-oxc-and-single-typecheck.md)          | TypeScript 7, Oxlint/Oxfmt, and single-engine typecheck                  | Accepted |
| [0011](0011-hono-trpc-api-hardening-and-contract-snapshots.md) | Hardened Hono + tRPC API and serialized contract snapshots               | Accepted |
| [0012](0012-react-vite-web-types-only-router.md)               | React + Vite web app over a types-only AppRouter import                  | Accepted |
| [0013](0013-testing-resilience-cross-os-ci-and-playwright.md)  | Testing resilience, 4-cell cross-OS CI matrix, and Playwright E2E        | Accepted |
| [0014](0014-hook-ci-parity-cspell-and-commitlint.md)           | Hook-CI parity, Node-native cspell, and commitlint conventions           | Accepted |
| [0015](0015-security-scanning-and-optional-org-automation.md)  | Two-layer secret scanning, CodeQL, OSV-Scanner, and optional org triage  | Accepted |
| [0016](0016-canonical-agents-md-and-plain-markdown-docs.md)    | Canonical AGENTS.md, plain CommonMark docs, and template-press lifecycle | Accepted |

## Note on historical decisions

Early architectural choices during the initial TypeScript port were recorded
by sequential IDs (`D-001`–`D-056`) before this `docs/adr/` directory existed.
Those foundational choices have been consolidated into ADRs `0001`–`0016` above,
and new architectural decisions are recorded **here** going forward.
