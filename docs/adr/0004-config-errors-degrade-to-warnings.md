# 0004. Discovered config errors degrade to warnings

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`Q4.A`, `D-017`)
- **Related:** `apps/cli/src/cli/config.ts`, [ADR 0002](0002-no-secrets-in-config-file.md)

## Context

The CLI discovers TOML configuration across three layers (`system` → `user` →
`project`). If a stray or partially edited discovered config file causes an
immediate crash, even `--help`, `config path`, or `doctor` becomes unusable.
Conversely, silently overwriting a corrupt config file would destroy user data.

## Decision

We will **degrade invalid discovered config layers/keys to stderr warnings**
while failing fast on explicit invalid overrides and corrupt write targets:

- Discovered `system`, `user`, and `project` TOML files with syntax errors or
  invalid schema values emit a diagnostic warning on stderr and fall back to
  valid defaults/layers.
- An explicit `--config <path>` or `TS_PROJECTS_CONFIG` override tolerates a
  missing file (uses defaults) but raises `ConfigError` (`TS001`) if the file
  exists and is malformed.
- Writes (`config init`, `config set`) use atomic `temp + fsync + rename`
  (`0o600` on POSIX) and refuse (`ConfigError`) to overwrite an existing corrupt
  TOML target.

## Consequences

- Diagnostic and recovery commands (`doctor`, `config path`, `--help`) keep
  working when a discovered TOML file is broken.
- Corrupt user config files are never silently clobbered.

## Alternatives considered

- **Crash on any invalid discovered TOML file** — breaks `doctor` and
  `--help` recovery workflows.
- **Overwrite corrupt files on `config set`** — risks silent data loss.
