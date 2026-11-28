# 0002. Secrets are never stored in the config file

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`Q4.A`, amending `D-017`)
- **Related:** `apps/cli/src/cli/config.ts`, `EXAMPLECLI.md`

## Context

The CLI reads runtime settings from layered TOML config files (`system` → `user`
→ `project`), environment variables (`TS_PROJECTS_TOKEN`), and flags (`--token`).
Storing API tokens inside config files risks accidental commits, backup leaks,
and plaintext exposure when sharing configuration files or diagnostic bundles.

## Decision

We will **never read or write secrets (including `token`) in any TOML config
file**:

- Authentication tokens are resolved exclusively from `--token` (highest
  precedence) or `TS_PROJECTS_TOKEN` (environment variable).
- `config init` and `config set token ...` reject persisting `token` to disk.
- `config get token` reports a masked summary (`****XXXX`) of the resolved
  runtime token without writing it.
- User config files written on POSIX still use `0o600` mode as defense-in-depth.

## Consequences

- Diagnostic bundles and config files can be inspected with drastically lower
  secret-leak risk.
- Users migrating from file-stored tokens must pass `--token` or export
  `TS_PROJECTS_TOKEN`; actionable missing-token hints guide them directly.

## Alternatives considered

- **Store `token` in `0600` TOML config with warning** — mode bits do not apply
  on Windows and do not prevent accidental repo commits or copy/paste leaks.
