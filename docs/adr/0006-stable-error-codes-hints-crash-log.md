# 0006. Unified ConfigError, stable error codes, hints, and crash log

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`P11`, `D-016`)
- **Related:** `packages/core/src/schemas/errors.ts`, `apps/cli/src/cli/exit-codes.ts`, `apps/cli/src/cli/crash-log.ts`

## Context

Previously `apps/cli` and `apps/api` maintained separate `ConfigError` classes,
errors lacked stable machine-readable identifiers or remediation hints, and
unexpected crashes (`TS000`) either flooded stderr with stack traces or hid
diagnostics.

## Decision

We will centralize errors in `packages/core/src/schemas/errors.ts` with an
**append-only error-code registry**, optional **hints**, and an **unexpected
error crash log**:

- `ConfigError`, `AuthError`, `ApiError`, `NotFoundError`, `ProjectNotFoundError`,
  `WorkspaceNotFoundError`, and `InterruptError` extend `DomainError` in
  `@ts-launch-blueprint/core` and are shared by `apps/cli` and `apps/api`.
- `ERROR_CODES` defines append-only codes `TS000`–`TS006` (`code` + optional
  `hint?: string`), surfaced in both human stderr output and structured JSON
  error envelopes.
- Unexpected `TS000` errors append a timestamped stack trace to
  `<state>/ts-projects/ts-projects_crash.log` (best-effort) and report
  `full traceback: <path>` (or `traceback_path` in JSON mode).

## Consequences

- Scripts and tests can match stable error codes (`TS000`–`TS006`) instead of
  brittle prose messages.
- Default stderr output stays clean for humans while preserving full debug
  context in the state directory crash log.

## Alternatives considered

- **Separate `ConfigError` per app** — causes drift and fails `instanceof`
  checks across shared helpers.
- **Dump raw stack traces on every error** — obscures actionable hints for end
  users.
