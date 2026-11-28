# P11 — CLI v4 noun-verb and config modernization

**References**

- **Trunk:** [PROJECTS.md](../PROJECTS.md)
- **Spec:** [EXAMPLECLI.md](../EXAMPLECLI.md)
- **Design:** [TS_PORT_DECISIONS.md](../docs/port/TS_PORT_DECISIONS.md)
- **Design:** [cli-reference.md](../docs/reference/cli-reference.md)
- **Design:** [configuration-files.md](../docs/reference/configuration-files.md)
- **Depends on:** P08
- **Depends on:** P10

Add config init/get/set, doctor bundle, completion, layered config, and pager

### Scope

- Unify `ConfigError` in `packages/core/src/schemas/errors.ts` (exported via `packages/core/src/index.ts`, removing duplicates in `apps/cli/src/cli/exit-codes.ts` and `apps/api/src/config.ts`), and add append-only `ERROR_CODES` (`TS000`–`TS006`), `ErrorCode`, `DomainErrorOptions`, `ProjectNotFoundError` (`TS005`), `WorkspaceNotFoundError` (`TS006`), `InterruptError` (`TS004`), and optional `hint?: string` across domain and CLI errors (Py ADR 0006).
- Align all three CLI contract seams with Py `v4.2.0` and `cli-standards` (`Q4.A`, superseding `D-017(1,3)` and `D-033`):
  - **Tokens (Py ADR 0002):** Resolve from `--token` > `TS_PROJECTS_TOKEN` only; never read or write `token` in TOML; reject `config set token`; keep `0o600` POSIX file mode as defense-in-depth.
  - **Paths (Py ADR 0011):** Expand `apps/cli/src/cli/xdg-paths.ts` to full quad (`configDir`, `configDirs`, `dataDir`, `stateDir`, `cacheDir`, `configFile`, `systemConfigFiles`, `projectConfigFile`); non-empty absolute `XDG_*` env vars win on all platforms; Windows defaults use `%APPDATA%`/`%LOCALAPPDATA%`/`%PROGRAMDATA%` (`;` separator); add injectable Windows flag for cross-OS unit tests.
  - **Global Output:** Move `-o, --output {text,json,csv,markdown}`, `--json`, and `--output-file <path>` to global options across all subcommands (`TS_PROJECTS_OUTPUT`, `[output].format`), adding GFM `markdown` formatting and structured JSON error output on stderr.
- Complete R5.1 3-layer TOML config discovery (`system` -> `user` -> `project` `./.ts-projects_config.toml` > `./ts-projects_config.toml`) with `[output]` and `[logging]` tables, warning degradation on invalid discovered files (Py ADR 0004), tolerated missing explicit `--config` / error on corrupt explicit `--config`, and atomic `temp + fsync + rename` writes with corrupt-file write refusal.
- Cut over `apps/cli` to a clean pre-1.0 noun-verb hierarchy (`Q3.A`): bare `ts-projects` prints help and exits `0`; `projects list` (retaining interactive TTY multi-select, `--workspace`, `--limit`, `--source`, `--copy`) and `projects get <id>` (via `ProjectsService.getProject`); `config init|path|get|set` (`--dry-run`, `-y/--yes`, stderr prompts); `doctor [--bundle]` (redacted `DiagnosticsBundle` for `TOKEN`/`SECRET`/`KEY`/`PASSWORD`/`CRED`/`PRIVATE`, excluding log contents); and `completion {bash,zsh,fish}`.
- Add diagnostics and interactive UX parity: unexpected-error (`TS000`) crash log in `<state>/ts-projects/ts-projects_crash.log` (Py ADR 0006), interactive pager (`TS_PROJECTS_PAGER > PAGER > less -FRX`, Py ADR 0008), one-time first-run onboarding hint (`<state>/ts-projects/ts-projects_first_run.marker`, Py ADR 0009), and `--log-level` / `--log-file [path]` (`TS_PROJECTS_LOG_*`, `[logging]` config).
- Update `apps/cli/src/lib.ts`, `apps/cli/tests/public-api.test.ts`, `apps/cli/tests/help-snapshots.test.ts` + `.snap`, CLI unit/property/E2E tests, `EXAMPLECLI.md` (dropping stale S5 placeholder), `docs/reference/cli-reference.md`, `docs/reference/configuration-files.md`, `docs/tasks/debugging-configuration.md`, and `README.md`; complete `ci-fix --optimize` closeout and pass all local and multi-OS CI gates.

### Out of scope

- Keeping legacy bare-root `ts-projects` `projects` default or `config --show` aliases (`Q3.A` clean pre-1.0 cutover).
- Storing `token` in TOML config files (`Q4.A` / Py ADR 0002).
- Release runbooks, `.github/SECURITY.md`, `.oss-scanner/`, `docs/adr/`, logos, and `publish.yml` `v*` trigger (`P13`).
- Merging release PR `#52` (kept held `OPEN` for human release-cut approval after `P13`).

### Decisions

- **Q3.A (Clean pre-1.0 noun-verb cutover):** Replace `{ isDefault: true }` on `projects` and `config --show` with `projects list|get`, `config init|path|get|set`, `doctor [--bundle]`, and `completion {bash,zsh,fish}`; bare `ts-projects` prints help (`0`).
- **Q4.A (Three CLI contract seams):** Supersede `D-017(1,3)` and `D-033` to align env/flag-only tokens (ADR 0002), cross-platform `XDG_*` + Windows defaults (ADR 0011), and global `-o/--output {text,json,csv,markdown}`, `--json`, `--output-file <path>` across all subcommands while preserving `cli-standards` R6.1 exit codes (`0/1/2/3/4/5/130/143`).
- **Unified `ConfigError` in `@ts-launch-blueprint/core`:** Place `ConfigError`, `InterruptError`, `ProjectNotFoundError`, `WorkspaceNotFoundError`, and `ERROR_CODES` (`TS000`–`TS006`) + `hint` in `packages/core/src/schemas/errors.ts` so `apps/cli` and `apps/api` share one class without violating `[app-no-cross-app-import]`, `[app-core-entry-only]`, or `[reexport-entry-only]`.
- **Closeout:** Mandatory `ci-fix --optimize` pass on the measured green multi-OS PR CI run (covering `ubuntu`, `macos`, and `windows` legs for `Q4.A`) before merge via `--merge`.

### Tests & Tasks

- [x] [P11-TS01] Add TDD tests in `packages/core/tests/errors.test.ts`, `packages/core/tests/projects.service.test.ts`, `packages/core/tests/public-api.test.ts`, `apps/api/tests/config.test.ts`, `apps/cli/tests/exit-codes.test.ts`, and `apps/cli/tests/config.test.ts` verifying `ERROR_CODES` (`TS000`–`TS006`), `readonly code` and optional `hint`/`cause` on `DomainError` subclasses, `WorkspaceNotFoundError` (`TS006`) and `ProjectNotFoundError` (`TS005`) extending `NotFoundError`, unified `ConfigError` exported from `@ts-launch-blueprint/core` (shared by `apps/api` and `apps/cli`), `exitCodeFor(ConfigError) === EXIT_CODES.error`, `exitCodeFor(InterruptError) === EXIT_CODES.sigint`, and `CliErrorOptions` on `CliError`/`UsageError`.
- [x] [P11-TS02] Add TDD unit and property tests in `apps/cli/tests/xdg-paths.test.ts` verifying `configDir`, `configDirs`, `dataDir`, `stateDir`, `cacheDir`, `configFile`, `systemConfigFiles`, and `projectConfigFile` (dotfile preference), non-empty absolute `XDG_*` precedence on all OSes (ignoring empty/relative values), POSIX defaults, and Windows `%APPDATA%`/`%LOCALAPPDATA%`/`%PROGRAMDATA%` defaults + `;` splitting via injectable Windows flag.
- [x] [P11-TS03] Add TDD unit and property tests in `apps/cli/tests/config.test.ts` and `apps/cli/tests/properties.test.ts` verifying env/flag-only token resolution (`--token` > `TS_PROJECTS_TOKEN`, ignoring TOML `token`, rejecting `config set token`), 3-layer TOML discovery (`system` -> `user` -> `project`), warning degradation on invalid discovered layers/keys, tolerated missing vs. failing corrupt explicit `--config`, atomic `temp + fsync + rename` (`0o600` POSIX) writes, and corrupt-file write refusal.
- [ ] [P11-TS04] Add TDD tests in `apps/cli/tests/cli-core.test.ts` and `apps/cli/tests/cli.test.ts` for the noun-verb CLI tree: bare `ts-projects` printing help (`0`), did-you-mean suggestions (`2`), `projects list` (including TTY multi-select, `--workspace`, `--limit`, `--source`, `--copy`) and `projects get <id>` (including `TS005` `ProjectNotFoundError` exit `3`), `config init|path|get|set` (`--dry-run`, `-y/--yes`, `--no-input` refusal, masked `token`), `doctor [--bundle]` (redacted `DiagnosticsBundle`), and `completion {bash,zsh,fish}`.
- [ ] [P11-TS05] Add TDD tests in `apps/cli/tests/format.test.ts` (or `cli-core.test.ts` / `properties.test.ts`) verifying global `-o/--output {text,json,csv,markdown}`, `--json`, and `--output-file <path>` across all subcommands, structured stderr JSON error envelopes (with `error_code`, `hint`, `traceback_path`), `TS000` crash log writing in XDG state dir, interactive pager gating/tokenization/fallback (`TS_PROJECTS_PAGER > PAGER > less -FRX`), one-time first-run marker hint, and `--log-level`/`--log-file`.
- [ ] [P11-TS06] Update `apps/cli/tests/public-api.test.ts`, `apps/cli/tests/help-snapshots.test.ts` (all 11 noun-verb commands at 80 cols), `apps/cli/tests/source.test.ts`, and `apps/cli/tests/e2e.test.ts` for the v4 noun-verb surface, global `--output`/`--json`/`--output-file`, and updated missing-token hint.
- [ ] [P11-TS07] Verify documentation links and spelling assertions covering updated `EXAMPLECLI.md`, `docs/reference/cli-reference.md`, `docs/reference/configuration-files.md`, `docs/tasks/debugging-configuration.md`, `README.md`, and `cspell.json` (`just docs-check`, `just check-spelling`).
- [ ] [P11-TS08] Verify `just pack-check` smoke and `tests/press-config.test.ts` / `just press-verify` compatibility for any new `ts-projects_*` / `TS_PROJECTS_*` tokens (`press/press-rules.toml` if needed).
- [x] [P11-T01] Implement `ERROR_CODES` (`TS000`–`TS006`), `ErrorCode`, `DomainErrorOptions`, `hint?: string`, `InterruptError`, `ProjectNotFoundError`, `WorkspaceNotFoundError`, and unified `ConfigError` in `packages/core/src/schemas/errors.ts` and `packages/core/src/index.ts`; throw `WorkspaceNotFoundError`/`ProjectNotFoundError` in `packages/core/src/services/projects.service.ts`; deduplicate `ConfigError` in `apps/api/src/config.ts` and `apps/cli/src/cli/exit-codes.ts` (plus `apps/cli/src/cli/config.ts` and `apps/cli/src/lib.ts`, mapping `InterruptError -> 130` and adding `CliErrorOptions`, with `isolatedDeclarations: true` annotations and boundary compliance).
- [x] [P11-T02] Implement cross-platform XDG + Windows path resolution (`apps/cli/src/cli/xdg-paths.ts`) and 3-layer TOML config discovery, env/flag-only token resolution, `[output]`/`[logging]` schemas, warning degradation, and atomic `temp + fsync + rename` + corrupt-refusal writes (`apps/cli/src/cli/config.ts`, `apps/cli/src/cli/deps.ts`).
- [ ] [P11-T03] Implement global `-o/--output {text,json,csv,markdown}`, `--json`, `--output-file`, `--log-level`, `--log-file` in `apps/cli/src/cli/router.ts`, `format.ts`, and `logger.ts`; remove `{ isDefault: true }` on `projects`; add `TS000` crash log (`crash-log.ts`), interactive pager (`pager.ts`), and first-run onboarding hint (`onboarding.ts`).
- [ ] [P11-T04] Implement noun-verb subcommands in `apps/cli/src/cli/commands/{projects,config,doctor,completion}.ts` (`projects list`, `projects get <id>`, `config init|path|get|set`, `doctor [--bundle]` via `diagnostics.ts`, `completion {bash,zsh,fish}`).
- [ ] [P11-T05] Update `apps/cli/src/lib.ts`, `apps/cli/src/cli/adapters.ts`, `apps/cli/tests/public-api.test.ts`, regenerated `apps/cli/tests/__snapshots__/help-snapshots.test.ts.snap`, and CLI E2E/property/unit suites; verify `just all`, `just coverage`, `just pack-check`, and `just press-verify`.
- [ ] [P11-T06] Update `EXAMPLECLI.md` (remove stale S5 placeholder), `docs/reference/cli-reference.md`, `docs/reference/configuration-files.md`, `docs/tasks/debugging-configuration.md`, `README.md` CLI examples, and `cspell.json` if needed; verify `just docs-check` and `just check-spelling`.
- [ ] [P11-T07] Open PR from `feat/p11-cli-v4-modernization`, verify all GitHub CI checks pass (including `ubuntu`, `macos`, and `windows` legs for `Q4.A`), and complete mandatory `ci-fix --optimize` closeout.
- [ ] [P11-T08] Resolve all PR review threads via `pr-merge-flow`, mark all `P11` tasks and `PROJECTS.md` `[x]`, merge via `--merge`, and fast-forward local `main` (leaving release PR `#52` held `OPEN`).
