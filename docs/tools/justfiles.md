# Using the Justfile

This project includes a [`Justfile`](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/Justfile) that defines useful commands for common development tasks. [Just](https://github.com/casey/just) is a simple command runner that helps standardize commands across your project.

To use these commands, first run Level 1 bootstrap (`make bootstrap` — or [install Just](https://github.com/casey/just#installation) directly):

```bash
make bootstrap         # ensures node >=24, pnpm 10, and just are installed
make install-just
make install-just-force
```

Refer to the [Makefiles documentation](./makefiles.md) for more details on these `make` commands.

Once `just` is installed, you can view all available commands by running `just --list` (or pick interactively with `just select-shell`).

Here are some commonly used commands (this is just a subset of all available commands):

```bash
# Unified Level 2 setup (base check, analyzers, pnpm install, hooks, check-deps)
just setup

# Full developer cycle (format, lint, typecheck, test, build; alias: just cycle)
just dev

# Format code (oxfmt writes fixes; imports sorted via sortImports)
just format

# Run linter (oxlint: correctness+suspicious at error severity)
just lint

# Run type checker
just typecheck

# Run tests
just test

# Run tests with coverage and open HTML report
just coverage
just open-coverage-report

# Run all quality gates (format-check, lint, boundaries, shell/workflow, editorconfig, cspell, typecheck, test)
just all

# Run lefthook pre-commit suite on all files / verify commits
just hooks-run       # alias: just hooks
just pre-commit-run  # alias: just pc
just verify-commits

# Run full CI sequence locally
just ci

# Check installed package version
just version

# Clean up build artifacts (apps/*/dist, packages/*/dist), caches, and node_modules
just clean

# Set up git hooks (lefthook) and wire the commit-message template
just setup-hooks

# Build apps/*/dist/
just build

# Run the CLI / API / web app
just run
just api             # build & run API on :8080
just api-dev         # watch/reload API dev server via tsx
just web
```

When dependencies are installed, you can also use direct commands through pnpm:

```bash
pnpm exec oxfmt        # Run formatter directly
pnpm exec oxlint       # Run linter directly
pnpm run typecheck     # Run type checker directly
pnpm exec vitest run   # Run tests directly with Vitest
```

## Editing conventions

When adding or editing recipes in `Justfile`:

1. Keep a blank line between recipes so each `[group('...')]` block and recipe body stays easy to scan.
2. Reuse existing group names from the `COMMANDS GROUPS` header (`setup`, `install`, `dev`, `test`, `build`, `run`, `docs`, `pre-commit`, `help`, `utilities`, `debug`, `releases`, `workflow`, `quick start`, `clean`).
3. Place a one-line doc comment above every recipe — `just --list` surfaces that line directly.

The Justfile standardizes common development tasks and provides a consistent interface for pnpm command execution.

For a full list of available commands, run `just --list`, `just select-shell`, or refer to the Justfile itself (and [CLI Reference](../reference/cli-reference.md)).
