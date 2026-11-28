# 0008. Windows-native default directories with XDG overrides everywhere

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`Q4.A`, amending `D-017(3)`)
- **Related:** `apps/cli/src/cli/xdg-paths.ts`, `apps/cli/tests/xdg-paths.test.ts`

## Context

Hardcoding `~/.config/<cli>` on Windows ignores native `%APPDATA%` /
`%LOCALAPPDATA%` / `%PROGRAMDATA%` conventions and uses POSIX `:` path-list
separators that collide with Windows drive letters (`C:\...`). At the same time,
developers on macOS or Windows who set `XDG_CONFIG_HOME`, `XDG_DATA_HOME`,
`XDG_STATE_HOME`, `XDG_CACHE_HOME`, or `XDG_CONFIG_DIRS` expect those explicit
overrides to win everywhere.

## Decision

We will resolve the full directory quad (`configDir`, `configDirs`, `dataDir`,
`stateDir`, `cacheDir`, plus `configFile`, `systemConfigFiles`, and
`projectConfigFile`) in `apps/cli/src/cli/xdg-paths.ts` using these rules:

- Non-empty, absolute `XDG_*` environment variables win on **all platforms**
  (empty or relative `XDG_*` values are ignored).
- POSIX defaults: `~/.config/<cli>`, `~/.local/share/<cli>`,
  `~/.local/state/<cli>`, `~/.cache/<cli>`, and system `/etc/xdg/<cli>`.
- Windows defaults (`win32`): `%APPDATA%\<cli>`, `%LOCALAPPDATA%\<cli>` (data
  and state), `%LOCALAPPDATA%\<cli>\Cache`, and system `%PROGRAMDATA%\<cli>`
  (fallback `C:/ProgramData`), splitting `XDG_CONFIG_DIRS` on `;`.
- Project-local config discovery prefers `./.<cli>_config.toml` over
  `./<cli>_config.toml`.

## Consequences

- Cross-platform behavior is consistent for both native Windows users and
  XDG-configured environments, verified on Ubuntu, macOS, and Windows CI legs.

## Alternatives considered

- **Use `env-paths`** — appends `-nodejs` suffixes and uses `~/Library/Preferences`
  on macOS instead of `~/.config/<cli>`, breaking XDG parity.
