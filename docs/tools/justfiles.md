# Using the Justfile

This project includes a [`Justfile`](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/Justfile) that defines useful commands for common development tasks. [Just](https://github.com/casey/just) is a simple command runner that helps standardize commands across your project.

To use these commands, first [install Just](https://github.com/casey/just#installation). Alternatively, this project's root `Makefile` provides convenient targets for installing and force-installing `just`:

```bash
make install-just
make install-just-force
```

Refer to the [Makefiles documentation](./makefiles.md) for more details on these `make` commands.

Once `just` is installed, you can view all available commands by running:

```bash
just --list
```

Here are some commonly used commands (this is just a subset of all available commands):

```bash
# Install project dependencies
just install

# Format code (oxfmt writes fixes; imports sorted via sortImports)
just format

# Run linter (oxlint: correctness+suspicious at error severity)
just lint

# Run type checker
just typecheck

# Run tests
just test

# Run all quality gates (format-check, lint, typecheck, test)
just all

# Check installed package version
just version

# Clean up build artifacts, caches, and installed dependencies
just clean

# Set up git hooks (lefthook) and wire the commit-message template
just setup-hooks

# Build the package
just build

# Run the package
just run
```

When dependencies are installed, you can also use direct commands through pnpm:

```bash
pnpm exec oxfmt        # Run formatter directly
pnpm exec oxlint       # Run linter directly
pnpm run typecheck     # Run type checker directly
pnpm exec vitest run   # Run tests directly with Vitest
```

The Justfile standardizes common development tasks and provides a consistent interface for pnpm command execution.

For a full list of available commands, run `just --list` or refer to the Justfile itself.
