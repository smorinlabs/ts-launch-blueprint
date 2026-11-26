# Application Setup

This guide prepares this application's development environment, runs its quality
gates, and builds its packages. Run the commands from the repository root.
Source-template provenance is recorded in
[the press receipt](../../press/press-receipt.toml) under `[press.from]`.

## 1. Check Foundational Tools

```bash
make check
```

Node **24 or newer** (`.nvmrc`, `engines.node`) and `just` are required, with
pnpm 10 (`packageManager` in `package.json`) managing dependencies. See
[Setting Up Development](../tasks/setting-up-development.md) for install
options.

## 2. Install Dependencies and Hooks

```bash
just install
just setup-hooks
```

`just install` installs the pinned shell/workflow analyzers and runs
`pnpm install` (which activates lefthook via `prepare`). `just setup-hooks`
ensures git hooks and `.gitmessage` are wired.

## 3. Verify Quality Gates

```bash
just all
just docs-check
```

`just all` runs formatting checks, linting, architecture boundary checks, shell
and workflow checks, type checking, and the Vitest suite.

## 4. Build and Run

```bash
just build
just run --help
just version
```

The CLI command name is listed in `apps/cli/package.json` under `bin` (see
[EXAMPLECLI.md](../../EXAMPLECLI.md) and
[CLI Reference](../reference/cli-reference.md)). For the HTTP API, run
`just api` and see [API Reference](../reference/api-reference.md).

## 5. Configure Releases and Repository Services

See [Release Runbook](../maintainers-release.md) to configure the `npm`
environment, npm Trusted Publishing (OIDC), and `release-please` credentials
before cutting your first release.
