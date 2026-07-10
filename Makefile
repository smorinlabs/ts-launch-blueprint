# Bootstrap-only Makefile (D-024(2)): checks for and helps install the two
# foundational tools — `just` and `node` — because almost everyone has `make`.
# It never wraps development tasks; those live in the Justfile.
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

# Shell-rc detection (generalizes the source Makefile's zsh hardcoding, D-024(2)):
# resolved at recipe runtime from the user's login $SHELL.
DETECT_RC = case "$${SHELL\#\#*/}" in zsh) RC_FILE="$$HOME/.zshenv";; bash) RC_FILE="$$HOME/.bashrc";; *) RC_FILE="$$HOME/.profile";; esac

.PHONY: all check install-just install-just-force install-node install-node-force install-pnpm set-path help

all: help

## `make check` Example Output

### Success case
# Checking dependencies...
# === System Requirements Status ===
# [✓] just
# [✓] node
# All dependencies are installed!

### Failure case
# Checking dependencies...
# === System Requirements Status ===
# [✓] just
# [✗] node (make install-node)
#
# Found 1 missing deps: node
# make: *** [check] Error 1

check: ## Check system requirements (just, node)
	@echo "Checking dependencies..."
	@echo "=== System Requirements Status ==="
	@ERROR_COUNT=0; \
	CHECK_CMD_NAME="just"; \
	CHECK_CMD_INSTALL="install-just"; \
	if [ $(shell command -v just >/dev/null 2>&1 && echo "0" || echo "1" ) -eq 0 ] ; then \
		printf "[$(CHECK)] $${CHECK_CMD_NAME}\n"; \
	else \
		printf "[$(CROSS)] $${CHECK_CMD_NAME} ($(GREEN)make $${CHECK_CMD_INSTALL}$(NC))\n"; \
		ERROR_COUNT=$$((ERROR_COUNT + 1)); \
		MISSING_DEPS="$${CHECK_CMD_NAME}$${MISSING_DEPS:+,} $${MISSING_DEPS}"; \
	fi; \
	CHECK_CMD_NAME="node"; \
	CHECK_CMD_INSTALL="install-node"; \
	if [ $(shell command -v node >/dev/null 2>&1 && echo "0" || echo "1" ) -eq 0 ] ; then \
		printf "[$(CHECK)] $${CHECK_CMD_NAME}\n"; \
	else \
		printf "[$(CROSS)] $${CHECK_CMD_NAME} ($(GREEN)make $${CHECK_CMD_INSTALL}$(NC))\n"; \
		ERROR_COUNT=$$((ERROR_COUNT + 1)); \
		MISSING_DEPS="$${CHECK_CMD_NAME}$${MISSING_DEPS:+,} $${MISSING_DEPS}"; \
	fi; \
	if [ "$${ERROR_COUNT}" = "0" ]; then \
		printf "$(GREEN)All dependencies are installed!$(NC)\n"; \
	else \
		echo ""; \
		printf "$(RED)Found $$ERROR_COUNT missing deps: $${MISSING_DEPS}$(NC)\n"; \
		exit 1; \
	fi

install-just: ## Print install just command and where to find install options
	@echo "just installation command:"
	@printf "$(CYAN)curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to ~/bin$(NC)\n"
	@echo "or"
	@printf "$(CYAN)make install-just-force$(NC)\n"
	@echo "NOTE: change ~/bin to the desired installation directory"
	@echo "Find other install options here: https://github.com/casey/just"
	@printf "To setup just PATH, run: $(YELLOW)SET_PATH=$(HOME)/bin make set-path$(NC)\n"

install-just-force: ## Install just to ~/bin and add it to PATH in your shell rc
	@echo "Installing just to ~/bin..."
	@curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to $(HOME)/bin
	@$(DETECT_RC); \
	echo "Adding $(HOME)/bin to PATH in $${RC_FILE}..."; \
	if ! grep -qs "$(HOME)/bin" "$${RC_FILE}"; then \
		echo "export PATH=\"$$PATH:$(HOME)/bin\"" >> "$${RC_FILE}"; \
		printf "$(GREEN)Added PATH entry:$(NC) $$PATH:$(HOME)/bin\n"; \
		printf "Run $(BLUE)source $${RC_FILE}$(NC) to apply changes\n"; \
	else \
		printf "[$(CHECK)] PATH already contains $(HOME)/bin\n"; \
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

set-path: ## Add SET_PATH to PATH in your shell rc if not already present
	@if [ -z "$(SET_PATH)" ]; then \
		printf "$(RED)Error: SET_PATH must be set$(NC)\n"; \
		printf "Usage: $(BLUE)make set-path SET_PATH=/your/path$(NC)\n"; \
		exit 1; \
	fi; \
	$(DETECT_RC); \
	if ! grep -qs "$(SET_PATH)" "$${RC_FILE}"; then \
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
