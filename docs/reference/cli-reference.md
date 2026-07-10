# Command-Line Interface (CLI) Reference

This section documents `ts-projects`, the example CLI shipped by this
template (`src/cli.ts`, `src/router.ts`, `src/commands/projects.ts`). It
is a TypeScript port of the source repo's `py-projects` tool; the full
UX spec and source-vs-port parity notes live in
[`EXAMPLECLI.md`](../../EXAMPLECLI.md).

## Overview

`ts-projects` searches and selects projects from a workspace-style API.
`projects` is the program's default command, so bare `ts-projects` runs
it directly — exactly like bare `py-projects` did in the source. A
second command, `config`, inspects the resolved configuration.

```bash
ts-projects [global options] [command] [command options]
```

---

## Global Options

These options are recognized before (or instead of) a subcommand and
apply to every invocation.

| Option            | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `-v, --verbose`   | Increase verbosity (repeatable: `-v` = debug, `-vv` = trace) |
| `-q, --quiet`     | Only show warnings and errors                                |
| `--debug`         | Maximum diagnostics; implies `-v` and overrides `-q`         |
| `--no-color`      | Disable colored output                                       |
| `--no-input`      | Never prompt; select all fetched projects                    |
| `--config <path>` | Path to a config file; replaces discovery (must exist)       |
| `--token <token>` | Personal access token                                        |
| `-V, --version`   | Output the version number (`ts-projects <version>`)          |
| `-h, --help`      | Display help for the command                                 |

---

## Commands

### `projects` (default)

Search, preview, and interactively select projects, then format and
route the result. Runs automatically when no other command is given.

#### Usage

```bash
ts-projects [options]
ts-projects projects [options]
```

#### Options

| Option               | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `--workspace <name>` | Filter projects by workspace name (case-insensitive)                     |
| `--limit <n>`        | Maximum number of projects to retrieve (positive integer; default `200`) |
| `--format <format>`  | Output format: `text` (default), `json`, or `csv`                        |
| `--json`             | Alias for `--format json`; conflicts with an explicit `--format`         |
| `--output <file>`    | Write results to a file instead of stdout                                |
| `--copy`             | Also copy the formatted result to the clipboard                          |

#### Behavior

- After the fetch, an interactive checkbox prompt (rendered on stderr)
  lets you select which projects flow into the output. The prompt only
  runs when stdin and stderr are both a TTY and `--no-input` was not
  passed; otherwise all fetched projects are selected automatically.
- Only the requested result document is ever written to stdout;
  spinners, preview tables, prompts, and notices render on stderr
  (pipe-safe by design).
- An empty fetch prints `No projects found.` on stderr and exits `0`.
  An empty selection prints `No projects selected` on stderr and exits
  `0`.
- Interrupting the prompt (`Ctrl-C`, or stdin closing mid-prompt)
  prints `Cancelled.` on stderr and exits **130**.

#### Examples

```bash
# Search for projects (fetch, preview, interactive multi-select)
ts-projects

# Filter by workspace
ts-projects --workspace "My Workspace"

# Limit results
ts-projects --limit 50

# JSON output, piped (pipe-safe: stdout carries exactly one JSON document)
ts-projects --no-input --format json | jq '.projects[].name'

# CSV output
ts-projects --format csv

# Write to a file and also copy to the clipboard
ts-projects --output projects.txt --copy

# Verbose diagnostics (adds the ID column to the preview table)
ts-projects --verbose
```

See [`EXAMPLECLI.md`](../../EXAMPLECLI.md) for the full options
reference, including the config-file precedence and the machine-mode
JSON error envelope.

---

### `config`

Inspect the resolved configuration (token source, workspace, limit,
config file path).

#### Usage

```bash
ts-projects config --show
```

#### Options

| Option   | Description                                             |
| -------- | ------------------------------------------------------- |
| `--show` | Print effective configuration values (secrets redacted) |

Without `--show`, `ts-projects config` prints the `config` subcommand's
help text.

#### Example

```bash
$ ts-projects config --show
token = "***abcd" (source: env)
workspace = (unset)
limit = (unset)
config_file = (none)
```

---

## Environment Variables

| Variable              | Effect                                                                          |
| --------------------- | ------------------------------------------------------------------------------- |
| `TS_PROJECTS_TOKEN`   | Personal access token (beats the config file; empty string is treated as unset) |
| `TS_PROJECTS_API_URL` | Overrides the API root (default `https://app.ts.com/api/1.0`)                   |
| `XDG_CONFIG_HOME`     | Overrides the config base directory                                             |
| `NO_COLOR`            | Disables colored output (any non-empty value)                                   |
| `FORCE_COLOR`         | Forces colored output even when not a TTY (`0` disables)                        |
| `CI`                  | Any non-empty value suppresses the fetch spinner                                |

Precedence for color: `--no-color` beats `NO_COLOR`, which beats
`FORCE_COLOR`, which beats TTY detection.

See [Configuration Files](./configuration-files.md) for the full
token/workspace/limit precedence rules and the TOML config file
format.

---

## Exit Codes

Per the org's cli-standards R6.1 exit-code contract:

| Code | Meaning                                                     |
| ---- | ----------------------------------------------------------- |
| 0    | Success (including benign empty results/selections)         |
| 1    | Generic/config/API error, unexpected exception              |
| 2    | Usage error (bad flag/command, nonexistent `--config` path) |
| 3    | Not found (e.g. workspace not found)                        |
| 4    | Authentication error (missing/invalid token)                |
| 5    | Conflict                                                    |
| 130  | Interrupted (`SIGINT`, including `Ctrl-C` at the prompt)    |
| 143  | Terminated (`SIGTERM`)                                      |

When JSON output is requested (`--format json` or `--json`), any error
raised after argument parsing is emitted on stderr as a single JSON
object instead of human text:

```json
{
  "error": {
    "code": "AuthError",
    "message": "No TS_PROJECTS_TOKEN found in environment or config file."
  }
}
```

`code` is the error class name (`AuthError`, `ApiError`,
`NotFoundError`, `ConfigError`, ...); usage errors (exit 2) are raised
during argument parsing and are exempt from the JSON envelope. Prompt
cancellation is never an error: it always prints `Cancelled.` and
exits 130, in every format.

> **Note for readers of the Python source's docs**: the source
> _documented_ 0 success / 1 configuration / 2 authentication / 3 API /
> 4 I/O / 5 interrupt, but its actual behavior used 1 for
> config-and-missing-token, 3 for API errors, and 4 for unexpected
> exceptions. This port adopts the normative cli-standards ladder
> above instead of either the source's docs or its as-implemented
> behavior; see `EXAMPLECLI.md`'s Exit Codes section for the full
> mapping rationale.

---

## Build and Quality-Gate Commands

The commands above are the `ts-projects` binary itself. Development
tasks (build, lint, format, typecheck, test) are run through the
Justfile, not through `ts-projects`:

```bash
just build       # tsdown build -> dist/
just typecheck   # tsc --noEmit
just lint        # oxlint
just format      # oxfmt --write
just test        # vitest run
just all         # format-check + lint + typecheck + test
```

See [Using the Justfile](../tools/justfiles.md) for the full command
surface.
