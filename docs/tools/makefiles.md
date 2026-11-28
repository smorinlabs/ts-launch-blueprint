# Makefile

A `Makefile` is a simple text file used by the `make` build automation tool to manage dependencies and automate the compilation of programs. It defines a set of rules to follow in order to compile and link the program. The `make` tool uses these rules to decide how to build and update executables, libraries, and other files in a project.

## Basic Structure

A `Makefile` consists of:

1. **Targets** – The files that need to be created.
2. **Dependencies** – The files that a target depends on.
3. **Commands** – The shell commands that make will run to create the target.

### General Syntax:

```
target: dependencies
    command
```

- `target`: The file to be created or updated (often the executable or object files).
- `dependencies`: Files that are required to build the target.
- `command`: A shell command to execute. Commands are usually preceded by a tab (not spaces).

This project uses a **Bootstrap-Only Makefile** for a specific purpose:

**Project Root Makefile (`Makefile`)**

- Used to install essential dependencies for development.
- Handles basic setup tasks.
- Primarily serves as a bootstrap for initializing the development environment.
- Does not wrap development tasks; those live in the Justfile.

## Usage

The Makefile in the root directory provides **Level 1 bootstrap** — it verifies and helps install the foundational tools (`just`, `node >=24`, `pnpm 10`) before handing off to **Level 2 setup** (`just setup`). Typical commands include:

```sh
make bootstrap             # Level 1 bootstrap: ensure node >=24, pnpm 10, and just are installed
make check                 # Check system requirements (just, node >=24, pnpm, optional docker)
make hook-check            # Verify external and workspace hook tools are available
make install-just          # Print the install command for 'just'
make install-just-force    # Install 'just' to ~/.local/bin and update PATH in your shell rc
make install-node          # Print Node.js install guidance
make install-node-force    # Install Node.js 24 via mise
make install-pnpm          # Print pnpm install guidance
make install-docker        # (Optional) Print Docker install instructions
make install-docker-force  # (Optional, Linux only) Install Docker engine
make install-flox          # (Optional) Print flox install instructions
```

### Checking System Requirements

Use `make check` to verify that required tools are installed:

```sh
make check
```

This checks for:

- **just** – Command runner for development tasks
- **node** – Runtime (version 24 or later is required)
- **pnpm** – Package manager (`packageManager` in `package.json`)
- **docker** _(optional)_ – Only needed for `just docker-build` / `just docker-run`

### Force Installing Core Dependencies

If you encounter issues with `just` or `node`, or want to install them explicitly, you can use the installation commands:

- `make install-just`: Prints the installation command for `just` (into `~/.local/bin`) as well as the rate-limit-free `--tag` / `uv tool install rust-just` fallback.

- `make install-just-force`: Runs the official `just` installation script into `~/.local/bin` (falling back to a pinned `--tag` release or `uv tool install rust-just` if the GitHub API rate-limits), then adds `~/.local/bin` to your `PATH` in `~/.zshenv`, `~/.bashrc`, or `~/.profile`.

- `make install-node`: Prints Node.js installation guidance. The recommended approach is to use a version manager (`mise`, `nvm`, or `fnm`).

- `make install-node-force`: Installs Node.js 24 via `mise` (if available). Ensure a Node version manager is installed first.

- `make install-pnpm`: Prints pnpm 10 installation guidance (standalone script, `npm install -g pnpm@10`, or Homebrew).

After running any installation command, especially a force install, ensure `~/.local/bin` is on your `PATH`, then continue with Level 2 setup (`just setup`).

## Additional Resources

For more details on how Makefiles work, refer to the [GNU Make Manual](https://www.gnu.org/software/make/manual/make.html).
