# 0007. CLI ergonomics: pager, guided init, onboarding marker, and doctor bundle

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`Q3.A`, `P11`)
- **Related:** `apps/cli/src/cli/pager.ts`, `apps/cli/src/cli/onboarding.ts`, `apps/cli/src/cli/diagnostics.ts`

## Context

Interactive CLI users benefit from comfortable defaults (paging long text output,
guided first-time setup, typo suggestions) and safe support diagnostics, while
automated scripts and CI pipes must never hang on pagers or leak secrets in
support bundles.

## Decision

We will implement four bounded CLI ergonomics controls:

- **Interactive pager (`pager.ts`):** Page text output through
  `TS_PROJECTS_PAGER > PAGER > less -FRX` only when output format is `text`,
  stdout is a TTY, `--output-file` and `--no-input` are unset, and rendered
  lines meet or exceed terminal height. An explicitly empty pager variable
  disables paging; spawn errors fall back cleanly to direct stdout.
- **Guided `config init` & onboarding (`onboarding.ts`):** Provide
  `config init [--dry-run] [-y/--yes]` with stderr prompts, plus a one-time
  `<state>/ts-projects/ts-projects_first_run.marker` onboarding hint on
  interactive stderr when no config files were loaded.
- **Did-you-mean suggestions:** Use Commander's built-in suggestion support
  (`2` usage exit code) with zero extra dependencies.
- **Redacting `doctor [--bundle]` (`diagnostics.ts`):** Inspect `node`,
  `platform`, `config-file`, and `token`; `--bundle` redacts environment keys
  matching `TOKEN|SECRET|KEY|PASSWORD|CRED|PRIVATE` at collection time and
  excludes log file contents.

## Consequences

- Long outputs are readable in interactive terminals without affecting piped
  commands or JSON/CSV automation.
- Support bundles avoid leaking credentials or private log contents.

## Alternatives considered

- **Always page or bundle raw logs** — breaks non-interactive scripts and risks
  exposing sensitive tokens in bug reports.
