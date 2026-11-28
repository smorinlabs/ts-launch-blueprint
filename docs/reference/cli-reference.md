# Command-Line Interface (CLI) Reference

This section documents `ts-projects`, the example CLI shipped by this
template (`apps/cli/src/cli.ts`, `apps/cli/src/cli/router.ts`, `apps/cli/src/cli/commands/`).
The full UX spec lives in [`EXAMPLECLI.md`](../../EXAMPLECLI.md).

## Overview

`ts-projects` uses a clean noun-verb command hierarchy (`Q3.A`). Bare
`ts-projects` (as well as bare `ts-projects projects` and `ts-projects config`)
prints help to stdout and exits `0`. Misspelled commands or flags emit
`Did you mean ...?` suggestions on stderr and exit `2`.

```bash
ts-projects [global options] <command> [command options]
```

---

## Global Options

Global options are accepted before or after any subcommand:

| Option                  | Description                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `-o, --output <format>` | Output format: `text`, `json`, `csv`, or `markdown` (env: `TS_PROJECTS_OUTPUT`)         |
| `--json`                | Shorthand for `--output json` (overrides `-o`, env, and config)                         |
| `--output-file <path>`  | Write formatted results to a file instead of stdout                                     |
| `--log-level <level>`   | Console log level: `debug`, `info`, `warning`, `error`, `critical`                      |
| `--log-file [path]`     | Enable rotating file logging (default: XDG state `<state>/ts-projects/ts-projects.log`) |
| `-v, --verbose`         | Increase verbosity (`-v` = `info`, `-vv` = `debug`, plus `TS000` stack trace)           |
| `-q, --quiet`           | Suppress non-essential stderr output and raise console level to `error`                 |
| `--debug`               | Enable `debug` logs and inline stack traces on errors                                   |
| `--no-color`            | Disable colored output                                                                  |
| `--no-input`            | Never prompt; select all fetched projects and disable interactive pager                 |
| `--config <path>`       | Path to a TOML config file (replaces 3-layer discovery)                                 |
| `--token <token>`       | Personal access token (overrides `TS_PROJECTS_TOKEN`)                                   |
| `-V, --version`         | Output the single-line version (`ts-projects <version>`)                                |
| `-h, --help`            | Display help for the command                                                            |

---

## Commands

### `projects list`

List projects, optionally filtered by workspace, with interactive TTY
multi-select and global output formatting.

```bash
ts-projects projects list [options]
```

| Option               | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `--workspace <name>` | Filter projects by workspace name (case-insensitive)                     |
| `--limit <n>`        | Maximum number of projects to retrieve (positive integer; default `200`) |
| `--source <name>`    | Data source: `http` (default) or `memory` (built-in demo data, no token) |
| `--copy`             | Copy the formatted result to the clipboard                               |

### `projects get <id>`

Fetch a single project by ID. Throws `ProjectNotFoundError` (`TS005`, exit `3`)
if not found.

```bash
ts-projects projects get <id> [options]
```

| Option            | Description                                |
| ----------------- | ------------------------------------------ |
| `--source <name>` | Data source: `http` (default) or `memory`  |
| `--copy`          | Copy the formatted result to the clipboard |

---

### `config`

Inspect and edit non-secret TOML configuration (`init`, `path`, `get`, `set`).

- `ts-projects config init [--dry-run] [-y, --yes]` — guided stderr prompts for `output.format`, `output.color`, and `logging.level`; writes atomically (`0o600` POSIX) and refuses corrupt targets.
- `ts-projects config path` — prints the resolved target config path and existence (`yes`/`no`), with a clickable OSC-8 `file://` link in TTY text mode.
- `ts-projects config get <key>` — resolves `logging.file`, `logging.file_level`, `logging.format`, `logging.level`, `output.color`, `output.format`, or `token` (masked `****XXXX` with `flag` / `env` / `-` source).
- `ts-projects config set <key> <value> [--dry-run] [-y, --yes]` — validates non-secret keys (rejects `token`), prompts before overwriting a differing existing value, and writes atomically.

---

### `doctor [--bundle]`

Check runtime and configuration health (`node` >=24, `platform`, `config-file`,
`token`). Warnings exit `0`; errors exit `1`. Pass `--bundle` for a redacted
`DiagnosticsBundle` safe to paste into bug reports (redacts `TOKEN`, `SECRET`,
`KEY`, `PASSWORD`, `CRED`, `PRIVATE` env vars; excludes log file contents).

---

### `completion <shell>`

Emit shell completion scripts to stdout (`bash`, `zsh`, or `fish`):

```bash
ts-projects completion bash
ts-projects completion zsh
ts-projects completion fish
```

---

## Environment Variables

| Variable                   | Effect                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `TS_PROJECTS_TOKEN`        | Personal access token (`--token` beats it; never stored in TOML)                          |
| `TS_PROJECTS_CONFIG`       | Explicit config file path (replaces discovery)                                            |
| `TS_PROJECTS_OUTPUT`       | Default output format (`text`, `json`, `csv`, `markdown`)                                 |
| `TS_PROJECTS_PAGER`        | Interactive pager override (`""` disables; falls back to `PAGER`, `less -FRX`)            |
| `TS_PROJECTS_LOG_LEVEL`    | Explicit console log level (`debug`, `info`, `warning`, `error`, `critical`)              |
| `TS_PROJECTS_LOG_FILE`     | File sink path (`""` enables default XDG state log file)                                  |
| `TS_PROJECTS_LOG_FORMAT`   | File sink format (`text` or `json` JSONL)                                                 |
| `TS_PROJECTS_API_URL`      | Overrides the API root (default `https://app.ts.com/api/1.0`)                             |
| `TS_PROJECTS_SOURCE`       | Data source: `http` (default) or `memory`                                                 |
| `XDG_*`                    | `XDG_CONFIG_HOME`, `XDG_CONFIG_DIRS`, `XDG_DATA_HOME`, `XDG_STATE_HOME`, `XDG_CACHE_HOME` |
| `NO_COLOR` / `FORCE_COLOR` | Color overrides                                                                           |
| `CI`                       | Any non-empty value suppresses the fetch spinner                                          |

See [Configuration Files](./configuration-files.md) for the full 3-layer TOML
schema and precedence rules.

---

## Exit Codes & Structured Errors

| Code  | Name        | Meaning                                                |
| ----- | ----------- | ------------------------------------------------------ |
| `0`   | `SUCCESS`   | Success (including bare help and benign empty results) |
| `1`   | `ERROR`     | Config (`TS001`), API (`TS003`), clipboard, or `TS000` |
| `2`   | `USAGE`     | Invalid flag, command, argument, or env value          |
| `3`   | `NOT_FOUND` | Project (`TS005`) or workspace (`TS006`) not found     |
| `4`   | `AUTH`      | Missing or rejected token (`TS002`)                    |
| `5`   | `CONFLICT`  | Conflict                                               |
| `130` | `SIGINT`    | Interrupted / cancelled / prompt declined (`TS004`)    |
| `143` | `SIGTERM`   | Terminated                                             |

In JSON mode (`--json` or `-o json`), errors after argument parsing emit a
single JSON object on stderr (with optional `error_code`, `hint`, and
`traceback_path` when present):

```json
{
  "error": {
    "code": 4,
    "name": "AUTH",
    "message": "No TS_PROJECTS_TOKEN found (never stored in the config file).",
    "error_code": "TS002",
    "hint": "supply it via --token or $TS_PROJECTS_TOKEN; `ts-projects doctor` checks setup"
  }
}
```

---

## Build and Quality-Gate Commands

```bash
just build       # tsdown build -> apps/cli/dist/
just typecheck   # tsc --noEmit
just lint        # oxlint
just format      # oxfmt --write
just test        # vitest run
just all         # format-check + lint + boundaries + shell/workflow + editorconfig + cspell + typecheck + test
```

See [Using the Justfile](../tools/justfiles.md) for the full command surface.
