# Debugging Your Configuration

`ts-projects` resolves its configuration from three layered sources, and
when something looks wrong — the wrong token is being used, a workspace
default isn't applying, a value you set in the config file is being
ignored — the fastest way to find out why is to ask the CLI itself, rather
than reading source. This guide walks through that.

> Looking for editor debug (breakpoint) sessions instead — VS Code,
> Cursor, Windsurf `launch.json`? See [VS Code](../tools/vs-code.md); this
> page is about debugging the CLI's _configuration_, not attaching a
> debugger to it.

## Inspecting the resolved configuration

`ts-projects config --show` prints the effective configuration after all
three layers have been merged, with the token redacted:

```bash
ts-projects config --show
```

```text
token = "***ab12" (source: env)
workspace = (unset)
limit = (unset)
config_file = /home/you/.config/ts-projects/ts-projects_config.toml
```

Each line tells you what the CLI would actually use if you ran a real
command right now:

- `token` — the redacted token value ([`redactToken`](../../src/lib/config.ts))
  and, in parentheses, which layer it came from: `flag`, `env`, `file`, or
  `none`.
- `workspace` / `limit` — only ever come from the config file (there is no
  `--workspace`/`--limit` config-file-equivalent flag layering for these
  two; `(unset)` means the file didn't set them).
- `config_file` — the path that was actually read, or `(none)` if no file
  was found (or `--config` wasn't given and discovery found nothing).

Run with `-v` (or `--debug`) to also see _why_ — `config --show` logs the
token source at `debug` level and a resolution-complete marker at `trace`
level on stderr:

```bash
ts-projects -v config --show
```

Running `ts-projects config` with no flag prints the subcommand's help
instead of resolving anything — `--show` is required to actually resolve
and print.

## Precedence order

The three configuration layers are merged with a fixed precedence
(D-017), implemented in
[`resolveConfig`](../../src/lib/config.ts):

1. **`--token` flag** (highest precedence)
2. **`TS_PROJECTS_TOKEN` environment variable**
3. **Config file** (`token = "..."` in the TOML file)

An empty-string flag value or environment variable is treated as unset and
falls through to the next layer — this mirrors the Python source's
falsy-`os.getenv` behavior. `workspace` and `limit` are file-only settings;
they don't have flag/env equivalents to take precedence over.

The config file tier can never "win" over the environment by surprise: the
file is read once, and the token comparison above is computed functionally
from the three already-loaded values — there's no code path where loading
the file after the environment overwrites an environment-sourced token.

## Where the config file lives

The default (discovery) path follows the XDG Base Directory convention
on every platform, including Windows (D-017(3)):

- `$XDG_CONFIG_HOME/ts-projects/ts-projects_config.toml` if
  `XDG_CONFIG_HOME` is set and non-empty, else
- `<home>/.config/ts-projects/ts-projects_config.toml` — where `<home>` is
  `os.homedir()`, i.e. `%USERPROFILE%\.config\ts-projects\...` on Windows
  (deliberately **not** `%APPDATA%`).

Pass `--config <path>` to bypass discovery entirely and read a specific
file instead. `--config` REPLACES discovery rather than adding to it, and
the path must already exist — pointing `--config` at a nonexistent file is
a usage error (exit 2), matching the Python source's
`click.Path(exists=True)` behavior:

```bash
ts-projects --config ./ci-config.toml config --show
```

See [Configuration Files](../reference/configuration-files.md) for the
full TOML schema (the `token`/`workspace`/`limit` keys and their types) and
[Managing Dependencies](managing-dependencies.md) /
[Setting Up Development](setting-up-development.md) for the rest of the
toolchain.

## The missing-token error (exit 4)

If none of the three layers supplies a token, resolution succeeds (there's
nothing malformed) but _using_ that resolved configuration fails: both
`config --show` and the default `projects` command call
[`requireToken`](../../src/lib/config.ts), which throws an `AuthError` —
mapped to **exit code 4** (D-016(2)):

```bash
$ ts-projects config --show
No TS_PROJECTS_TOKEN found in environment or config file.
To set your ts-projects token, you have three options:
1. Use the --token option when running the command:
   ts-projects --token your_token_here
2. Set the TS_PROJECTS_TOKEN environment variable:
   export TS_PROJECTS_TOKEN=your_token_here
3. Add it to the config file /home/you/.config/ts-projects/ts-projects_config.toml:
   token = "your_token_here"
   Then restrict access with: chmod 600 /home/you/.config/ts-projects/ts-projects_config.toml
   (Windows note: chmod cannot scope file modes there; your
   %USERPROFILE% ACLs already limit the file to your account.)
You can get your token from: https://app.ts.com/settings/tokens
$ echo $?
4
```

Exit 4 is reserved for authentication failures under the project's
exit-code contract (`EXIT_CODES.auth` in
[`src/lib/errors.ts`](../../src/lib/errors.ts)) — this is a deliberate
divergence from the Python source, which exited 1 for a missing token. A
malformed config file (bad TOML, or a value that fails the zod schema —
e.g. a non-numeric `limit`) is a **different** failure mode: it's a
`ConfigError`, not an `AuthError`, and exits 1.

## Common Issues and Solutions

1. **`config --show` reports `source: env` but I expected the file value**

   - **Cause**: the environment variable takes precedence over the file by
     design.
   - **Solution**: `unset TS_PROJECTS_TOKEN` in the current shell if you
     want the file value to apply, or pass `--token` explicitly to
     override both.

2. **`config_file = (none)` even though I created the file**

   - **Cause**: the file isn't at the discovered path — check
     `echo $XDG_CONFIG_HOME` and confirm the file is really at
     `$XDG_CONFIG_HOME/ts-projects/ts-projects_config.toml` (or
     `~/.config/ts-projects/...` if `XDG_CONFIG_HOME` is unset).
   - **Solution**: run `ts-projects --config <path> config --show` to
     confirm the file itself parses correctly, independent of discovery.

3. **A loose-permissions warning appears on stderr**

   - **Cause**: the config file contains a `token` value and is readable
     by group/other on POSIX (D-017(6)).
   - **Solution**: `chmod 600 <config-file-path>` as the warning suggests.
     This check is skipped on Windows, where file modes can't express
     group/other access the same way.

4. **Invalid TOML or a schema violation (e.g. `limit = "ten"`)**

   - **Cause**: the file fails to parse, or a value doesn't match the
     schema (`token`/`workspace` must be strings, `limit` a positive
     integer).
   - **Solution**: the error message names the offending path and reason;
     fix the file and re-run `config --show` to confirm.
