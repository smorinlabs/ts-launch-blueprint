# Set project-wide variables (template-rename seam, D-029)
ts_package_name := "ts-launch-blueprint"
repo_name := "ts-launch-blueprint"
command_name := "ts-projects"
args := " "

# Text colors
BLACK := '\033[30m'
RED := '\033[31m'
GREEN := '\033[32m'
YELLOW := '\033[33m'
BLUE := '\033[34m'
MAGENTA := '\033[35m'
CYAN := '\033[36m'
WHITE := '\033[37m'
GRAY := '\033[90m'

# Background colors
BG_BLACK := '\033[40m'
BG_RED := '\033[41m'
BG_GREEN := '\033[42m'
BG_YELLOW := '\033[43m'
BG_BLUE := '\033[44m'
BG_MAGENTA := '\033[45m'
BG_CYAN := '\033[46m'
BG_WHITE := '\033[47m'

# Text styles
BOLD := '\033[1m'
DIM := '\033[2m'
ITALIC := '\033[3m'
UNDERLINE := '\033[4m'

# Reset all styles
NC := '\033[0m'

# Display a symbol
CHECK := GREEN + "✓" + NC
CROSS := RED + "✗" + NC
DASH := GRAY + "-" + NC

# List all available recipes
[group('help')]
@default:
    just --list --unsorted

# ================================
# COMMANDS GROUPS
# ================================
# SETUP: Initial project setup and environment initialization
# INSTALL: Installing the project and its dependencies
# UPDATE: Updating dependencies, versions, and configurations
# DEV: Development workflow commands and utilities
# TEST: Test execution and test environment management
# BUILD: Building distributable packages and artifacts
# RUN: Executing the application in various modes
# DOCS: Documentation generation and management
# PRE-COMMIT: Linting, formatting, and code quality checks
# HELP: Usage instructions and command information
# UTILITIES: General utility and maintenance commands
# DEBUG: Debugging and troubleshooting tools
# RELEASES: Version management and publishing
# WORKFLOW: CI/CD pipelines and multi-step processes
# QUICK START: Essential commands for basic usage
# CLEAN: Removing build artifacts, caches, and temporary files
# LEGACY: Deprecated recipes kept only for reference
# ================================
# (CLEAN and LEGACY were used-but-undocumented in the Python source's block;
# listed here to fix that drift. The legacy pip recipes themselves are dropped
# per D-024(1); the LEGACY group is reserved.)

# Check if required tools are installed
[group('setup'), group('debug')]
check-deps:
    #!/usr/bin/env sh
    if ! command -v node >/dev/null 2>&1; then printf "{{YELLOW}}node is not installed{{NC}}\n RUN {{BLUE}}make install-node{{NC}}\n"; exit 1; fi
    if ! command -v npm >/dev/null 2>&1; then printf "{{YELLOW}}npm is not installed{{NC}} (it ships with Node)\n RUN {{BLUE}}make install-node{{NC}}\n"; exit 1; fi
    if ! command -v just >/dev/null 2>&1; then printf "{{YELLOW}}just is not installed{{NC}}\n RUN {{BLUE}}make install-just{{NC}}\n"; exit 1; fi
    if ! command -v git >/dev/null 2>&1; then printf "{{YELLOW}}git is not installed{{NC}}\n Install: {{BLUE}}xcode-select --install{{NC}} (macOS) or {{BLUE}}sudo apt install git{{NC}} (Debian/Ubuntu)\n"; exit 1; fi
    echo "All required tools are installed"
    # Optional tools (advisory only; not required to build/test the project):
    if ! command -v actionlint >/dev/null 2>&1; then printf "{{YELLOW}}(optional) actionlint not installed{{NC}} — lints .github/workflows/; install: {{BLUE}}brew install actionlint{{NC}} or {{BLUE}}go install github.com/rhysd/actionlint/cmd/actionlint@latest{{NC}}\n"; fi

alias c := check-deps

# Install project dependencies (generates/updates package-lock.json)
[group('install'), group('quick start')]
@install: check-deps
    npm install

# Build distributable package (dist/) with tsdown
[group('build'), group('dev')]
@build:
    npm run build

alias b := build

# Format code (oxfmt writes fixes; imports sorted via sortImports, D-014(3))
[group('dev'), group('pre-commit')]
@format:
    echo "Running formatter..."
    echo "  oxfmt --write (+ sortImports)"
    npx oxfmt

alias f := format

# Check formatting without writing (CI-parity gate)
[group('pre-commit')]
@format-check:
    echo "Checking formatting..."
    echo "  oxfmt --check"
    npx oxfmt --check

alias fc := format-check

# Run linter (oxlint: correctness+suspicious at error severity, D-014)
[group('dev'), group('pre-commit')]
@lint:
    echo "Running linters..."
    echo "  oxlint"
    npx oxlint

alias l := lint

# Run linter with autofixes applied
[group('dev')]
@lint-fix:
    npx oxlint --fix

# Run type checker (tsc --noEmit)
[group('dev')]
@typecheck:
    echo "Running type checker..."
    echo "  tsc --noEmit"
    npm run typecheck

alias tc := typecheck

# Run tests
[group('test'), group('dev')]
@test *options:
    npx vitest run {{options}}

alias t := test

# Run tests with coverage (95/95/90/95 thresholds enforced)
[group('test')]
@coverage:
    npm run test:coverage

# Run all quality gates (format-check, lint, typecheck, test)
[group('test'), group('dev'), group('quick start')]
@all: format-check lint typecheck test

alias a := all

# Run the full hook-suite gates on ALL files (CI mirror of the
# pre-commit/commit-time discipline; source pre-commit-run intent)
[group('pre-commit')]
@pre-commit-run: format-check lint typecheck test

alias pc := pre-commit-run

# Run the full CI sequence locally (mirror of .github/workflows/ci.yml).
# Same order CI runs: install deps, the direct quality gates, build, then the
# whole hook suite on all files (the source's dual-enforcement parity).
[group('workflow')]
@ci: install format-check lint typecheck test build
    npx lefthook run pre-commit --all-files

# Install git hooks (lefthook) and wire the commit-message template
[group('setup'), group('pre-commit')]
@setup-hooks:
    npx lefthook install
    git config commit.template .gitmessage
    echo "Hooks installed; commit template wired (.gitmessage)"

# Run package command
[group('run'), group('quick start')]
@run *args=args:
    node dist/cli.js {{args}}

# Check built package version
[group('releases'), group('utilities')]
@version:
    node dist/cli.js --version

# Render CONTRIBUTORS.md from the committed contributor-state ledger
# (.contributors.jsonl) via the org's contributors-please CLI (D-024(9)).
# Single implementation shared with .github/workflows/update-contributors.yml —
# fixes the Python source's divergent recipe-vs-script defect (its malformed
# `@contributors:` orphan recipe is not carried).
[group('utilities')]
@contributors:
    npx contributors-please render

# Show release version surface: package.json, manifest, latest tag + drift
# (D-021(1,2)). Read-only; never touches the registry.
[group('releases')]
release-status:
    #!/usr/bin/env sh
    set -eu
    PKG=$(node -p "require('./package.json').version")
    MAN=$(node -p "require('./.release-please-manifest.json')['.']")
    TAG=$(git tag --list 'v*' --sort=-v:refname | head -n 1)
    [ -n "$TAG" ] || TAG="(no v* tag yet)"
    printf "package.json : %s\n" "$PKG"
    printf "manifest     : %s\n" "$MAN"
    printf "latest tag   : %s\n" "$TAG"
    if [ "$PKG" != "$MAN" ]; then
        printf "{{YELLOW}}drift: package.json (%s) != manifest (%s){{NC}}\n" "$PKG" "$MAN"
    elif [ "$TAG" != "v$PKG" ] && [ "$TAG" != "(no v* tag yet)" ]; then
        printf "{{YELLOW}}drift: latest tag (%s) != v%s — unreleased commits or pending Release PR{{NC}}\n" "$TAG" "$PKG"
    else
        printf "{{CHECK}} version surface consistent\n"
    fi

# Local packaging validation (D-012(7)): build, publint, attw, npm pack
# --dry-run file-list assertion, then pack + install into a /private/tmp
# scratch project and smoke-test the bin + ESM lib import. Registry-free:
# --dry-run and local install never contact npmjs.com.
[group('releases'), group('build')]
pack-check:
    #!/usr/bin/env sh
    set -eu
    echo "{{CYAN}}[1/6] build{{NC}}"
    npm run build
    echo "{{CYAN}}[2/6] publint{{NC}}"
    npx publint
    echo "{{CYAN}}[3/6] attw (--profile esm-only: ESM-only package is intentional){{NC}}"
    npx @arethetypeswrong/cli --pack . --profile esm-only
    echo "{{CYAN}}[4/6] npm pack --dry-run file-list assertion{{NC}}"
    npm pack --dry-run --json --ignore-scripts > /tmp/ts-pack-dryrun.json
    node -e '
      const pack = require("/tmp/ts-pack-dryrun.json");
      const files = pack[0].files.map((f) => f.path);
      const rootWhitelist = new Set(["package.json", "README.md", "LICENSE", "CHANGELOG.md"]);
      const bad = files.filter((p) => !p.startsWith("dist/") && !rootWhitelist.has(p));
      if (bad.length > 0) { console.error("Unexpected packed files:", bad); process.exit(1); }
      for (const req of ["package.json", "dist/cli.js", "dist/lib.js", "dist/lib.d.ts"]) {
        if (!files.includes(req)) { console.error("Missing required packed file:", req); process.exit(1); }
      }
      console.log("  OK:", files.length, "files (dist/** + root whitelist).");
    '
    VERSION=$(node -p "require('./package.json').version")
    SCRATCH=$(mktemp -d /private/tmp/ts-pack-check.XXXXXX)
    trap 'rm -rf "$SCRATCH"' EXIT
    echo "{{CYAN}}[5/6] pack + install tarball into $SCRATCH{{NC}}"
    TARBALL=$(npm pack --ignore-scripts --pack-destination "$SCRATCH" --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(d[0].filename)")
    printf '{"name":"pack-check-scratch","private":true,"type":"module"}\n' > "$SCRATCH/package.json"
    ( cd "$SCRATCH" && npm install --no-save --no-package-lock "$SCRATCH/$TARBALL" >/dev/null 2>&1 )
    echo "{{CYAN}}[6/6] smoke: installed bin --version + ESM lib import{{NC}}"
    BIN_VERSION=$("$SCRATCH/node_modules/.bin/{{command_name}}" --version)
    EXPECTED="{{command_name}} $VERSION"
    if [ "$BIN_VERSION" != "$EXPECTED" ]; then
        printf "{{RED}}bin --version (%s) != expected (%s){{NC}}\n" "$BIN_VERSION" "$EXPECTED"; exit 1
    fi
    echo "  bin {{command_name}} --version = $BIN_VERSION"
    ( cd "$SCRATCH" && node -e 'import("{{ts_package_name}}").then((m) => { if (typeof m.VERSION !== "string") { console.error("ESM import: VERSION missing"); process.exit(1); } console.log("  ESM lib import OK, VERSION=" + m.VERSION); }).catch((e) => { console.error(e); process.exit(1); })' )
    printf "{{CHECK}} pack-check passed\n"

# Clean up build artifacts, caches, and installed dependencies
[group('clean')]
@clean:
    rm -rf dist
    rm -rf coverage
    rm -rf node_modules
    rm -f *.tsbuildinfo

# Collect system and environment information for debugging (dependency-free)
[group('debug')]
debug-info:
    #!/usr/bin/env sh
    echo "## Debug Information"
    echo ""
    echo "### System Information"
    echo "- Date: $(date)"
    echo "- OS Family: {{os_family()}}"
    if [ "{{os()}}" = "macos" ]; then
        echo "- macOS Version: $(sw_vers -productVersion)"
        echo "- Kernel: $(uname -r)"
        echo "- Architecture: $(uname -m)"
    elif [ "{{os_family()}}" = "unix" ]; then
        if command -v lsb_release >/dev/null 2>&1; then
            echo "- Distribution: $(lsb_release -ds)"
        elif [ -f /etc/os-release ]; then
            . /etc/os-release
            echo "- Distribution: ${PRETTY_NAME}"
        fi
        echo "- Kernel: $(uname -r)"
        echo "- Architecture: $(uname -m)"
    else
        echo "- Kernel: $(uname -r)"
        echo "- Architecture: $(uname -m)"
    fi
    echo "- Git Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'Not a git repository or error')"
    echo ""
    echo "### Development Tools"
    if command -v node >/dev/null 2>&1; then echo "node: $(node --version)"; else echo "node: Not Found"; fi
    if command -v npm >/dev/null 2>&1; then echo "npm: $(npm --version)"; else echo "npm: Not Found"; fi
    if command -v git >/dev/null 2>&1; then echo "git: $(git --version)"; else echo "git: Not Found"; fi
    if command -v just >/dev/null 2>&1; then echo "just: $(just --version)"; else echo "just: Not Found"; fi
    echo "CLI Version ({{command_name}}): $(node dist/cli.js --version 2>/dev/null || echo 'Not Found (run: just build)')"
    if command -v node >/dev/null 2>&1; then
        echo "Project Version: $(node -p "JSON.parse(require('node:fs').readFileSync('package.json','utf8')).version" 2>/dev/null || echo 'Version Not Found')"
    fi
    echo ""
    echo "### Installed Project Packages"
    if command -v npm >/dev/null 2>&1; then npm ls --depth=0 2>/dev/null || echo "(no node_modules; run 'just install')"; else echo "npm not found, cannot list packages"; fi
    echo ""
    echo "### Declared Dependencies (package.json)"
    if command -v node >/dev/null 2>&1; then
        node -p "const p=JSON.parse(require('node:fs').readFileSync('package.json','utf8')); JSON.stringify({dependencies:p.dependencies??{},devDependencies:p.devDependencies??{}},null,2)" 2>/dev/null || echo "Could not read dependencies from package.json"
    else
        echo "node not found, cannot read package.json"
    fi
