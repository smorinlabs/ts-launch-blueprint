# Debugging Your Configuration

`ts-projects` resolves configuration from three layered TOML sources
(`system` → `user` → `project`) plus env/flag-only secrets. When
something looks wrong — the wrong token source, an unexpected output
format, or a value ignored due to validation warnings — use `doctor` and
`config` to inspect the resolved state.

> Looking for editor debug (breakpoint) sessions instead — VS Code,
> Cursor, Windsurf `launch.json`? See [VS Code](../tools/vs-code.md); this
> page is about debugging the CLI's _configuration_, not attaching a
> debugger to it.

## Checking setup and configuration

Run `ts-projects doctor` (or `ts-projects doctor --bundle --json` for a
redacted snapshot safe to paste into bug reports):

```bash
ts-projects doctor
ts-projects doctor --bundle --json
```

Inspect individual keys and paths with `config`:

```bash
ts-projects config path
ts-projects config get output.color
ts-projects config get logging.level
ts-projects config get token
```

- `config get token` shows the masked token (`****XXXX` or empty) and
  source (`flag`, `env`, or `-`). Per ADR 0002, tokens are never stored
  in TOML files.
- `config get <section.key>` reports `source: config` when a valid
  config layer set it, or `source: default` when using the built-in
  default.
- Run with `--log-level debug` (or `--debug`, or `--log-file`) to
  inspect `invocation context ready` diagnostics on stderr or in the log
  file.

## Precedence order

- **Tokens (ADR 0002)**: `--token` > `TS_PROJECTS_TOKEN` (empty strings
  treated as unset; TOML `token` keys are ignored).
- **Config layers (ADR 0004)**: `system` → `user` → `project`
  (`./.ts-projects_config.toml` > `./ts-projects_config.toml`). Explicit
  `--config <path>` or `TS_PROJECTS_CONFIG` replaces discovery.
- **Output format**: `--json` > `-o/--output` > `TS_PROJECTS_OUTPUT` >
  `[output].format` > `text`.

## Where config and state files live (ADR 0011)

`XDG_CONFIG_HOME`, `XDG_CONFIG_DIRS`, `XDG_DATA_HOME`, `XDG_STATE_HOME`,
and `XDG_CACHE_HOME` win on all platforms when set, non-empty, and
absolute. Otherwise:

- **POSIX**: `~/.config/ts-projects/ts-projects_config.toml` (user),
  `/etc/xdg/ts-projects/ts-projects_config.toml` (system),
  `~/.local/state/ts-projects/` (logs, crash log, onboarding marker).
- **Windows**: `%APPDATA%\ts-projects\ts-projects_config.toml` (user),
  `%PROGRAMDATA%\ts-projects\ts-projects_config.toml` (system),
  `%LOCALAPPDATA%\ts-projects\` (data/state), `%LOCALAPPDATA%\ts-projects\Cache` (cache).

See [Configuration Files](../reference/configuration-files.md) for the
full schema.

## The missing-token error (`TS002`, exit 4)

If neither `--token` nor `TS_PROJECTS_TOKEN` is set when running
`projects list` or `projects get` in `http` mode, `requireToken` throws
`AuthError` (`TS002`, exit `4`) with a structured `hint`:

```bash
$ ts-projects projects list --no-input
Error: No TS_PROJECTS_TOKEN found (never stored in the config file).
To set your ts-projects token, you have two options:
1. Use the --token option when running the command:
   ts-projects --token your_token_here
2. Set the TS_PROJECTS_TOKEN environment variable:
   export TS_PROJECTS_TOKEN=your_token_here
Run `ts-projects doctor` to check your setup. (TS002)
hint: supply it via --token or $TS_PROJECTS_TOKEN; `ts-projects doctor` checks setup
```

## Common Issues and Solutions

1. **A `warning: ignoring invalid config value ...` line appears on stderr**

   - **Cause**: A discovered config layer (`system`, `user`, or `project`) has
     an invalid setting value (e.g. `output.color = "yes"`). Per ADR 0004,
     discovered files degrade cleanly by dropping only the invalid key instead
     of crashing.
   - **Solution**: Inspect the path shown in the warning (or
     `ts-projects config path` for the user file), then run
     `ts-projects config set <key> <valid-value>` (omit `--config` for the user
     file, or pass `--config <path>` to target a non-user layer).

2. **A `warning: ignoring unreadable config file ...` line appears on stderr**

   - **Cause**: A discovered config layer is unreadable or contains invalid TOML
     syntax. Per ADR 0004, discovered files degrade cleanly by skipping the
     broken layer.
   - **Solution**: Manually edit or remove the offending file shown in the
     warning (`config set` and `config init` refuse to overwrite corrupt TOML
     files).

3. **`config set` or `config init` refuses to write**

   - **Cause**: Either the target TOML file has a syntax error (corrupt
     files are never overwritten silently), or `--no-input` was passed
     when confirmation (`--yes`) is required.
   - **Solution**: Fix/remove the corrupt file, or pass `--yes` for
     non-interactive scripts.

4. **Explicit `--config <path>` fails with exit `1` (`TS001`)**

   - **Cause**: Unlike missing explicit paths (which are tolerated), an
     unreadable or syntactically invalid explicit `--config` raises
     `ConfigError` (`TS001`).
   - **Solution**: Validate the TOML syntax in the explicit file.

5. **Unexpected crash (`TS000`)**

   - **Cause**: An unexpected runtime failure wrote a full traceback to
     `<state>/ts-projects/ts-projects_crash.log`.
   - **Solution**: Inspect the path shown in `full traceback: <path>` or
     attach `ts-projects doctor --bundle --json` (never contains secrets
     or log contents) to a bug report.
