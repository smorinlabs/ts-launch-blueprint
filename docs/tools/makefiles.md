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

The Makefile in the root directory is used to check system requirements and set up the development environment. Typical commands include:

```sh
make check                 # To check system requirements (just, node)
make install-just         # To print the install command for tool 'just'
make install-just-force   # To forcibly install the 'just' command runner
make install-node         # To print the Node.js install guidance
make install-node-force   # To forcibly install Node.js (requires mise)
```

### Checking System Requirements

Use `make check` to verify that required tools are installed:

```sh
make check
```

This will check for:

- **just** – Command runner for development tasks
- **node** – Runtime (version 24 or later is required)

### Force Installing Core Dependencies

If you encounter issues with `just` or `node`, or if you want to ensure you have the very latest version, you can use the installation commands:

- `make install-just`: Prints the installation command for `just`. You can run it manually or use the force variant below.

- `make install-just-force`: This command runs the official `just` installation script. It will install `just` to `~/bin` and automatically add this directory to your PATH in your shell configuration file (`~/.zshenv`, `~/.bashrc`, or `~/.profile`) if it's not already there.

- `make install-node`: Prints Node.js installation guidance. The recommended approach is to use a version manager (mise, nvm, or fnm).

- `make install-node-force`: This command installs Node.js 24 via mise (if available). Ensure a Node version manager is installed first.

After running any installation command, especially a force install, ensure the tool's installation directory (e.g., `~/bin` for `just`) is correctly configured in your system's `PATH`.

## Additional Resources

For more details on how Makefiles work, refer to the [GNU Make Manual](https://www.gnu.org/software/make/manual/make.html).
