# Configuration Files

This section documents the configuration files used by this project:
the TOML file `ts-projects` reads at runtime, and the project's own
tooling configuration (package manifest, TypeScript, lint/format,
hooks, tests, build, release). Understanding these files will help you
customize and extend the project.

## User Configuration (TOML + XDG)

`ts-projects` reads an optional TOML config file for the token,
default workspace, and default limit (`src/lib/config.ts`,
`src/lib/xdg-paths.ts`).

### File location

By XDG base-directory convention, the file lives at:

- `$XDG_CONFIG_HOME/ts-projects/ts-projects_config.toml`, if
  `XDG_CONFIG_HOME` is set and non-empty; otherwise
- `<home>/.config/ts-projects/ts-projects_config.toml` — on **all**
  platforms, including Windows (`%USERPROFILE%\.config\ts-projects\`).

`--config <path>` points the CLI at an explicit file instead. That path
must exist (a missing path is a usage error, exit 2) and it _replaces_
discovery entirely — the default user config is not merged in.

### Keys

```toml
token = "your_token_here"   # personal access token
workspace = "My Workspace"  # default workspace filter
limit = 200                 # default maximum number of projects
```

All keys are optional and validated with a zod schema
(`configFileSchema` in `src/lib/config.ts`): `token`/`workspace` are
strings, `limit` is a positive integer. An invalid file (bad TOML, or
a value that fails schema validation) is a configuration error, exit 1.

### Precedence

Token resolution, highest precedence first:

1. `--token <token>` flag
2. `TS_PROJECTS_TOKEN` environment variable
3. `token` key in the config file

`workspace` and `limit` follow the same shape: the config file supplies
a default, and an explicit `--workspace`/`--limit` flag always wins.
An empty-string environment variable is treated as unset, matching the
flag/file behavior.

### Permissions

The CLI's own config writer (used by tooling, not by an interactive
`ts-projects` command) sets file mode `0600` on POSIX. When a
token-bearing config file is readable by group or others, `ts-projects`
prints a non-fatal warning suggesting `chmod 600`. Windows file modes
cannot express user/group/other access, so this check — and the
`chmod` remediation — apply to POSIX only; on Windows, the
`%USERPROFILE%` directory's default ACLs already scope the file to
your account.

### Inspecting the effective configuration

```bash
ts-projects config --show
```

See [CLI Reference: `config`](./cli-reference.md#config) and
[`EXAMPLECLI.md`](../../EXAMPLECLI.md) for the full walkthrough,
including the Windows `icacls` hardening example.

> **Migration note (Python source)**: the source stored its token in a
> dotenv file (`~/.config/py-cli/.env`, key `PY_TOKEN`). The port
> replaces that tier with the TOML file described above; there is no
> `.env` config tier and no dotenv dependency.

---

## Project Configuration Files

The files below configure the project's own toolchain — they are not
read by `ts-projects` at runtime.

### `package.json`

The central manifest: name (`ts-launch-blueprint`), version (bumped
exclusively by release-please — see
[Versioning](./versioning.md)), the `ts-projects` bin entry, the ESM
`exports` map, npm scripts (`build`, `typecheck`, `test`,
`test:coverage`, `prepare`), dependencies/devDependencies, and the
`engines`/`devEngines` Node >=24 floor. See
[package.json](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/package.json).

### `tsconfig.json`

Configures `tsc`, used here as the typecheck gate only (`noEmit:
true` — build output is owned by tsdown). Notable settings: `strict`
mode plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
and `isolatedDeclarations` (enables tsdown's fast oxc-based `.d.ts`
emission). See
[tsconfig.json](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/tsconfig.json)
and [Type Checking](../tasks/type-checking-code.md).

### `.oxlintrc.json`

Configures Oxlint, the linter. The `correctness` and `suspicious`
categories run at `error` severity, with additional rules for
security-adjacent built-ins (`no-eval`, `no-implied-eval`, ...) and
modernization (`no-var`, `prefer-const`). An `overrides` block relaxes
a few rules under `tests/**`. See
[.oxlintrc.json](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/.oxlintrc.json)
and [Oxlint](../tools/oxlint.md).

### `.oxfmtrc.json`

Configures Oxfmt, the formatter (also used for import sorting via
`sortImports`, and for formatting JSON/YAML/Markdown). `printWidth:
100`, `singleQuote: true`, `trailingComma: "es5"`. An
`ignorePatterns` list excludes the port's own process-log documents,
which cross-reference each other by line number. See
[.oxfmtrc.json](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/.oxfmtrc.json).

### `lefthook.yml`

Configures lefthook, the git-hooks runner (installed via the
package.json `prepare` script). Runs `format` + `check-large-files` +
`lint` + `typecheck` in parallel on `pre-commit`, `commitlint` on
`commit-msg`, and an opt-in test run on `pre-push`
(`TS_PROJECTS_PREPUSH_TESTS=1`). See
[lefthook.yml](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/lefthook.yml)
and [Lefthook](../tools/lefthook.md).

### `commitlint.config.mjs`

Configures commitlint, which enforces Conventional Commits on every
commit message (`commit-msg` hook, above). Extends
`@commitlint/config-conventional` with a fixed `type-enum` list
(`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`,
`build`, `perf`, `revert`) and 50/72 header/body line-length limits.
`commitlint.config.d.mts` declares its shape for the repo-hygiene meta
test. See
[commitlint.config.mjs](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/commitlint.config.mjs).

### `vitest.config.ts`

Configures Vitest, the test runner. Node environment, no injected
globals, v8 coverage with 95/95/90/95 (lines/functions/branches/
statements) thresholds. `src/cli.ts` and `src/lib/adapters.ts` are
excluded from coverage as thin I/O adapters exercised by the
subprocess/e2e test tier instead. See
[vitest.config.ts](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/vitest.config.ts)
and [Vitest](../tools/vitest.md).

### `tsdown.config.ts`

Configures tsdown, the bundler. Two entry points (`src/cli.ts`,
`src/lib.ts`), ESM output, `.d.ts` emission via the isolated-
declarations fast path, source maps, and `clean: true`. See
[tsdown.config.ts](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/tsdown.config.ts).

### `release-please-config.json` and `.release-please-manifest.json`

Configure release-please, which owns version bumps and changelog
generation from Conventional Commits (`release-type: node`,
`bump-minor-pre-major: true`, manifest mode). The `changelog-sections`
list maps commit types to CHANGELOG.md headings. See
[Versioning and Release Management](./versioning.md) for the full
release flow, and
[release-please-config.json](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/release-please-config.json).
