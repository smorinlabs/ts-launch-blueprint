# Bootstrap-only Makefile (D-024(2)): checks for and helps install the
# foundational tools — `just`, `node`, and `pnpm` — because almost everyone
# has `make`. Development tasks live in the Justfile.
SHELL := /bin/sh

# Text colors
RED := \033[31m
GREEN := \033[32m
YELLOW := \033[33m
BLUE := \033[34m
CYAN := \033[36m
GRAY := \033[90m

# Reset
NC := \033[0m

CHECK := $(GREEN)✓$(NC)
CROSS := $(RED)✗$(NC)
DASH := $(GRAY)-$(NC)

JUST_FALLBACK_VERSION ?= 1.59.0

# Shell-rc detection (generalizes the source Makefile's zsh hardcoding, D-024(2)):
# resolved at recipe runtime from the user's login $SHELL.
DETECT_RC = case "$${SHELL\#\#*/}" in zsh) RC_FILE="$$HOME/.zshenv";; bash) RC_FILE="$$HOME/.bashrc";; *) RC_FILE="$$HOME/.profile";; esac

.PHONY: all bootstrap check hook-check install-just install-just-force install-node install-node-force install-pnpm install-docker install-docker-force install-flox set-path help

all: help

## `make check` Example Output

### Success case
# Checking dependencies...
# === System Requirements Status ===
# [✓] just
# [✓] node
# [✓] pnpm
# [✓] docker (optional)
# All dependencies are installed!

### Failure case
# Checking dependencies...
# === System Requirements Status ===
# [✓] just
# [✗] node (make install-node)
# [✗] pnpm (make install-pnpm)
#
# Found 2 missing deps: node, pnpm
# make: *** [check] Error 1

bootstrap: ## Level 1 bootstrap: ensure node >=24, pnpm 10, and just are installed
	@echo "Bootstrapping base toolchain (Level 1: node >=24, pnpm 10, just)..."
	@PATH="$(HOME)/.local/bin:$$PATH"; \
	if ! command -v node >/dev/null 2>&1 || ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)" >/dev/null 2>&1; then \
		if command -v mise >/dev/null 2>&1; then \
			echo "Installing Node 24 via mise..."; \
			mise use --global node@24; \
		else \
			printf "[$(CROSS)] Node.js >=24 is required.\n" >&2; \
			$(MAKE) --no-print-directory install-node; \
			exit 1; \
		fi; \
	fi; \
	if ! command -v pnpm >/dev/null 2>&1; then \
		if command -v npm >/dev/null 2>&1; then \
			echo "Installing pnpm@10 via npm..."; \
			npm install -g pnpm@10 || curl -fsSL https://get.pnpm.io/install.sh | sh -; \
		else \
			printf "[$(CROSS)] pnpm 10 is required.\n" >&2; \
			$(MAKE) --no-print-directory install-pnpm; \
			exit 1; \
		fi; \
	fi; \
	if ! command -v just >/dev/null 2>&1; then \
		echo "Installing just to $(HOME)/.local/bin..."; \
		mkdir -p "$(HOME)/.local/bin"; \
		curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to "$(HOME)/.local/bin" \
		|| { \
			echo "just.systems latest installer failed — retrying with --tag $(JUST_FALLBACK_VERSION)..."; \
			curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --tag "$(JUST_FALLBACK_VERSION)" --to "$(HOME)/.local/bin"; \
		} \
		|| { \
			if command -v uv >/dev/null 2>&1; then \
				echo "Falling back to rust-just via uv..."; \
				uv tool install rust-just; \
			else \
				printf "[$(CROSS)] failed to install just (see https://github.com/casey/just)\n" >&2; \
				exit 1; \
			fi; \
		}; \
	fi
	@PATH="$(HOME)/.local/bin:$$PATH" $(MAKE) --no-print-directory check
	@printf "If $(HOME)/.local/bin is not on your PATH, run: $(YELLOW)SET_PATH=$(HOME)/.local/bin make set-path$(NC)\n"
	@printf "$(GREEN)Level 1 bootstrap complete.$(NC) Next: $(CYAN)just setup$(NC)\n"

check: ## Check system requirements (just, node, pnpm, optional docker)
	@echo "Checking dependencies..."
	@echo "=== System Requirements Status ==="
	@PATH="$(HOME)/.local/bin:$$PATH"; \
	ERROR_COUNT=0; \
	MISSING_DEPS=""; \
	CHECK_CMD_NAME="just"; \
	CHECK_CMD_INSTALL="install-just"; \
	if command -v just >/dev/null 2>&1; then \
		printf "[$(CHECK)] $${CHECK_CMD_NAME}\n"; \
	else \
		printf "[$(CROSS)] $${CHECK_CMD_NAME} ($(GREEN)make $${CHECK_CMD_INSTALL}$(NC))\n"; \
		ERROR_COUNT=$$((ERROR_COUNT + 1)); \
		MISSING_DEPS="$${CHECK_CMD_NAME}"; \
	fi; \
	CHECK_CMD_NAME="node"; \
	CHECK_CMD_INSTALL="install-node"; \
	if command -v node >/dev/null 2>&1 && node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)" >/dev/null 2>&1; then \
		printf "[$(CHECK)] $${CHECK_CMD_NAME}\n"; \
	else \
		printf "[$(CROSS)] $${CHECK_CMD_NAME} ($(GREEN)make $${CHECK_CMD_INSTALL}$(NC))\n"; \
		ERROR_COUNT=$$((ERROR_COUNT + 1)); \
		MISSING_DEPS="$${MISSING_DEPS:+$${MISSING_DEPS}, }$${CHECK_CMD_NAME}"; \
	fi; \
	CHECK_CMD_NAME="pnpm"; \
	CHECK_CMD_INSTALL="install-pnpm"; \
	if command -v pnpm >/dev/null 2>&1; then \
		printf "[$(CHECK)] $${CHECK_CMD_NAME}\n"; \
	else \
		printf "[$(CROSS)] $${CHECK_CMD_NAME} ($(GREEN)make $${CHECK_CMD_INSTALL}$(NC))\n"; \
		ERROR_COUNT=$$((ERROR_COUNT + 1)); \
		MISSING_DEPS="$${MISSING_DEPS:+$${MISSING_DEPS}, }$${CHECK_CMD_NAME}"; \
	fi; \
	if command -v docker >/dev/null 2>&1; then \
		printf "[$(CHECK)] docker (optional)\n"; \
	else \
		printf "[$(DASH)] docker (optional — only for just docker-build / just docker-run; $(GREEN)make install-docker$(NC))\n"; \
	fi; \
	if [ "$${ERROR_COUNT}" = "0" ]; then \
		printf "$(GREEN)All dependencies are installed!$(NC)\n"; \
	else \
		echo ""; \
		printf "$(RED)Found $$ERROR_COUNT missing deps: $${MISSING_DEPS}$(NC)\n"; \
		exit 1; \
	fi

hook-check: ## Verify every binary invoked by lefthook hooks is available
	@echo "Checking git hook tools..."
	@echo "=== Hook Toolchain Status ==="
	@PATH="$(HOME)/.local/bin:$$PATH"; \
	ERROR_COUNT=0; \
	MISSING_EXT=""; \
	MISSING_WS=""; \
	for TOOL in node pnpm just gitleaks actionlint shellcheck editorconfig-checker; do \
		if command -v "$${TOOL}" >/dev/null 2>&1; then \
			printf "[$(CHECK)] $${TOOL}\n"; \
		else \
			printf "[$(CROSS)] $${TOOL}\n"; \
			ERROR_COUNT=$$((ERROR_COUNT + 1)); \
			MISSING_EXT="$${MISSING_EXT:+$${MISSING_EXT} }$${TOOL}"; \
		fi; \
	done; \
	for TOOL in lefthook oxfmt oxlint depcruise cspell commitlint tsc; do \
		if [ -x "node_modules/.bin/$${TOOL}" ] || command -v "$${TOOL}" >/dev/null 2>&1; then \
			printf "[$(CHECK)] $${TOOL} (workspace)\n"; \
		else \
			printf "[$(CROSS)] $${TOOL} (workspace)\n"; \
			ERROR_COUNT=$$((ERROR_COUNT + 1)); \
			MISSING_WS="$${MISSING_WS:+$${MISSING_WS} }$${TOOL}"; \
		fi; \
	done; \
	if [ "$${ERROR_COUNT}" = "0" ]; then \
		printf "$(GREEN)All hook tools are installed!$(NC)\n"; \
	else \
		echo ""; \
		printf "$(RED)Found $$ERROR_COUNT missing hook tools.$(NC)\n"; \
		if [ -n "$${MISSING_EXT}" ]; then \
			printf "Missing external binaries ($${MISSING_EXT}): run $(CYAN)make bootstrap && just setup$(NC)\n"; \
			printf "  (or individually: $(CYAN)just install-shell-tools$(NC), $(CYAN)just install-editorconfig-checker$(NC), $(CYAN)just install-gitleaks$(NC))\n"; \
		fi; \
		if [ -n "$${MISSING_WS}" ]; then \
			printf "Missing workspace tools ($${MISSING_WS}): run $(CYAN)pnpm install$(NC) (or $(CYAN)just setup$(NC))\n"; \
		fi; \
		exit 1; \
	fi

install-just: ## Print install just command and where to find install options
	@echo "just installation command:"
	@printf "$(CYAN)curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to ~/.local/bin$(NC)\n"
	@echo "or"
	@printf "$(CYAN)make install-just-force$(NC)\n"
	@echo "Rate-limit-free fallback (skips api.github.com):"
	@printf "  $(CYAN)curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --tag $(JUST_FALLBACK_VERSION) --to ~/.local/bin$(NC)\n"
	@printf "  or: $(CYAN)uv tool install rust-just$(NC)\n"
	@echo "NOTE: change ~/.local/bin to the desired installation directory"
	@echo "Find other install options here: https://github.com/casey/just"
	@printf "To setup just PATH, run: $(YELLOW)SET_PATH=$(HOME)/.local/bin make set-path$(NC)\n"

install-just-force: ## Install just to ~/.local/bin and add it to PATH in your shell rc
	@echo "Installing just to $(HOME)/.local/bin..."
	@mkdir -p "$(HOME)/.local/bin"
	@curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to "$(HOME)/.local/bin" \
	|| { \
		echo "just.systems latest installer failed — retrying with --tag $(JUST_FALLBACK_VERSION)..."; \
		curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --tag "$(JUST_FALLBACK_VERSION)" --to "$(HOME)/.local/bin"; \
	} \
	|| { \
		if PATH="$(HOME)/.local/bin:$$PATH" command -v uv >/dev/null 2>&1; then \
			echo "Falling back to rust-just via uv..."; \
			PATH="$(HOME)/.local/bin:$$PATH" uv tool install rust-just; \
		else \
			printf "[$(CROSS)] failed to install just (see https://github.com/casey/just)\n" >&2; \
			exit 1; \
		fi; \
	}
	@$(DETECT_RC); \
	echo "Adding $(HOME)/.local/bin to PATH in $${RC_FILE}..."; \
	if [ ! -f "$${RC_FILE}" ] || ! grep -qs "$(HOME)/.local/bin" "$${RC_FILE}"; then \
		echo "export PATH=\"$$PATH:$(HOME)/.local/bin\"" >> "$${RC_FILE}"; \
		printf "$(GREEN)Added PATH entry:$(NC) $$PATH:$(HOME)/.local/bin\n"; \
		printf "Run $(BLUE)source $${RC_FILE}$(NC) to apply changes\n"; \
	else \
		printf "[$(CHECK)] PATH already contains $(HOME)/.local/bin\n"; \
	fi
	@echo "Please 'source' your shell rc or open a new terminal to update your PATH."

install-node: ## Print Node.js install guidance (version managers, print-first)
	@echo "Node.js >=24 is required (see .nvmrc / package.json engines)."
	@echo "Install with a version manager (recommended):"
	@printf "  mise:  $(CYAN)mise use --global node@24$(NC)\n"
	@printf "  nvm:   $(CYAN)nvm install 24 && nvm use 24$(NC)  (reads .nvmrc: $(CYAN)nvm install$(NC))\n"
	@printf "  fnm:   $(CYAN)fnm install 24 && fnm use 24$(NC)\n"
	@echo "or"
	@printf "$(CYAN)make install-node-force$(NC)  (uses mise if available)\n"
	@echo "Other options: https://nodejs.org/en/download"

install-node-force: ## Install Node 24 via mise (opt-in force variant)
	@if command -v mise >/dev/null 2>&1; then \
		echo "Installing Node 24 via mise..."; \
		mise use --global node@24 && printf "$(GREEN)Node installed via mise$(NC)\n"; \
	else \
		printf "$(RED)mise not found.$(NC) Install a Node version manager first:\n"; \
		echo "  mise: https://mise.jdx.dev/getting-started.html"; \
		echo "  nvm:  https://github.com/nvm-sh/nvm (shell function; run 'nvm install' yourself)"; \
		exit 1; \
	fi

install-pnpm: ## Print pnpm install guidance (print-first, Corepack-free)
	@echo "pnpm 10 is the package manager for this project (see package.json"
	@echo "  \"packageManager\"). It self-manages its exact version once any"
	@echo "  pnpm >=10 is on PATH (managePackageManagerVersions in .npmrc)."
	@echo "Install pnpm with one of:"
	@printf "  standalone: $(CYAN)curl -fsSL https://get.pnpm.io/install.sh | sh -$(NC)\n"
	@printf "  npm:        $(CYAN)npm install -g pnpm@10$(NC)  (npm ships with Node)\n"
	@printf "  Homebrew:   $(CYAN)brew install pnpm$(NC)\n"
	@echo "Corepack is NOT used (it is being removed from Node); the standalone"
	@echo "  script or a global npm install is the supported bootstrap path."
	@echo "Other options: https://pnpm.io/installation"

install-docker: ## OPTIONAL — print Docker install instructions (needed only for just docker-build/run)
	@echo "Docker is OPTIONAL for this project — only container builds and runs"
	@echo "(just docker-build / just docker-run) need it. Everything else runs without Docker."
	@echo ""
	@echo "Linux installation command (Docker convenience script):"
	@printf "$(CYAN)curl -fsSL https://get.docker.com | sh$(NC)\n"
	@echo "or"
	@printf "$(CYAN)make install-docker-force$(NC)\n"
	@echo "macOS/Windows: install Docker Desktop — https://docs.docker.com/get-docker/"

install-docker-force: ## OPTIONAL — install Docker engine via convenience script (Linux only)
	@if [ "$$(uname -s)" != "Linux" ]; then \
		printf "$(RED)install-docker-force supports Linux only.$(NC)\n"; \
		echo "macOS/Windows: install Docker Desktop — https://docs.docker.com/get-docker/"; \
		exit 1; \
	fi
	@echo "Installing Docker engine via https://get.docker.com ..."
	@curl -fsSL https://get.docker.com | sh
	@printf "[$(CHECK)] Docker installed. You may need to add your user to the docker group:\n"
	@printf "$(CYAN)sudo usermod -aG docker $$USER && newgrp docker$(NC)\n"

# Flox is OPTIONAL — one of the three first-class toolchain provisioners
# (native installs / mise / flox; see .flox/env/manifest.toml). Nothing in the
# project requires it; `flox activate` simply provisions the same toolset.
install-flox: ## (Optional) Print flox install instructions (.flox/env/manifest.toml)
	@echo "flox is OPTIONAL — it provisions the dev toolchain declared in .flox/env/manifest.toml."
	@echo ""
	@echo "macOS (Homebrew):"
	@printf "  $(CYAN)brew install flox$(NC)\n"
	@echo ""
	@echo "Linux (Debian/Ubuntu — download the .deb, then):"
	@printf "  $(CYAN)sudo apt install ./flox.x86_64-linux.deb$(NC)\n"
	@echo "Linux (Fedora/RHEL — download the .rpm, then):"
	@printf "  $(CYAN)sudo dnf install ./flox.x86_64-linux.rpm$(NC)\n"
	@echo ""
	@echo "Downloads and all install options (incl. nix profile): https://flox.dev/docs/install-flox/"
	@echo ""
	@printf "Then run $(YELLOW)flox activate$(NC) from the repo root to enter the environment.\n"

set-path: ## Add SET_PATH to PATH in your shell rc if not already present
	@if [ -z "$(SET_PATH)" ]; then \
		printf "$(RED)Error: SET_PATH must be set$(NC)\n"; \
		printf "Usage: $(BLUE)make set-path SET_PATH=/your/path$(NC)\n"; \
		exit 1; \
	fi; \
	$(DETECT_RC); \
	if [ ! -f "$${RC_FILE}" ] || ! grep -qs "$(SET_PATH)" "$${RC_FILE}"; then \
		echo "export PATH=\"\$$PATH:$(SET_PATH)\"" >> "$${RC_FILE}"; \
		printf "$(GREEN)Added PATH entry:$(NC) \$$PATH:$(SET_PATH)\n"; \
		printf "Run $(BLUE)source $${RC_FILE}$(NC) to apply changes\n"; \
	else \
		printf "[$(CHECK)] PATH already contains $(SET_PATH)\n"; \
	fi

help: ## The help command - this command
	@echo ""
	@echo "Purpose of this Makefile:"
	@echo "  To make it easy to check for and install"
	@printf "  the main dependencies because almost everyone has $(GREEN)make$(NC)\n"
	@echo "  Development tasks live in the Justfile (run 'just')."
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -h -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "$(CYAN)%-30s$(NC) %s\n", $$1, $$2}'
	@echo ""
