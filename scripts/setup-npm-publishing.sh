#!/usr/bin/env bash
set -euo pipefail

# Print the exact values needed to configure npmjs.com Trusted Publishing (OIDC)
# for the published CLI package (apps/cli/package.json) and validate that
# .github/workflows/publish.yml has the required OIDC / environment settings.
#
# Trusted Publishing requires no NPM_TOKEN secret — GitHub Actions exchanges a
# short-lived OIDC token (`id-token: write`) directly with npmjs.com.
#
# Usage:
#   scripts/setup-npm-publishing.sh [owner/repo]
#
# If owner/repo is omitted, the script detects it via `gh repo view` or the
# `origin` git remote.

WORKFLOW_FILE=".github/workflows/publish.yml"
CLI_MANIFEST="apps/cli/package.json"
ENVIRONMENT="npm"

usage() {
    cat <<'EOF'
Usage: scripts/setup-npm-publishing.sh [--help|-h] [owner/repo]

Print the npmjs.com Trusted Publisher (OIDC) configuration fields for the
published CLI package (`apps/cli/package.json`) and validate
`.github/workflows/publish.yml`.

If owner/repo is omitted, the repository is detected via `gh repo view` or
the `origin` git remote.
EOF
}

bold() { printf '\x1b[1m%s\x1b[0m' "$*"; }
cyan() { printf '\x1b[36m%s\x1b[0m' "$*"; }
warn() { printf '\x1b[33mwarning:\x1b[0m %s\n' "$*" >&2; }
die()  { printf '\x1b[31merror:\x1b[0m %s\n' "$*" >&2; exit 1; }

if [[ $# -ge 1 ]]; then
    case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            echo "error: unknown option: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
fi

if [[ $# -gt 1 ]]; then
    echo "error: unexpected argument: $2" >&2
    usage >&2
    exit 2
fi

if [[ $# -eq 1 ]]; then
    [[ "$1" =~ ^[^/]+/[^/]+$ ]] || die "repo must be in 'owner/repo' form, got: $1"
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" \
    || die "run from inside the repo (git rev-parse failed)"
cd "$repo_root"

if [[ $# -eq 1 ]]; then
    repo="$1"
else
    repo=""
    if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
        repo="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
    fi
    if [[ -z "$repo" ]]; then
        remote_url="$(git config --get remote.origin.url 2>/dev/null || true)"
        [[ -n "$remote_url" ]] || die "could not detect repo (no gh match or origin remote); pass owner/repo as the first arg"
        repo="$(printf '%s' "$remote_url" \
            | sed -E 's#^(https?://[^/]+/|git@[^:]+:)##; s#\.git$##')"
    fi
fi

[[ "$repo" =~ ^[^/]+/[^/]+$ ]] || die "repo must be in 'owner/repo' form, got: $repo"
owner="${repo%%/*}"
repo_name="${repo##*/}"

[[ -f "$CLI_MANIFEST" ]] || die "$CLI_MANIFEST not found at $repo_root"
command -v node >/dev/null 2>&1 || die "node is required to parse $CLI_MANIFEST"

package_name="$(node -e '
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (typeof pkg.name !== "string" || pkg.name.trim() === "") process.exit(1);
process.stdout.write(pkg.name.trim());
' "$CLI_MANIFEST" 2>/dev/null)" \
    || die "could not read package name from $CLI_MANIFEST"

workflow_filename="$(basename "$WORKFLOW_FILE")"

# --- workflow sanity checks ----------------------------------------------------
if [[ ! -f "$WORKFLOW_FILE" ]]; then
    warn "$WORKFLOW_FILE not found — npm Trusted Publishing requires this workflow on the default branch."
else
    grep -qE 'id-token:[[:space:]]*write' "$WORKFLOW_FILE" \
        || warn "$WORKFLOW_FILE has no 'id-token: write' permission — OIDC auth will fail."
    grep -qE "environment:[[:space:]]*${ENVIRONMENT}([[:space:]]|$)" "$WORKFLOW_FILE" \
        || warn "$WORKFLOW_FILE does not reference environment '$ENVIRONMENT'."
    grep -qE 'npm publish' "$WORKFLOW_FILE" \
        || warn "$WORKFLOW_FILE does not invoke 'npm publish'."
    grep -qE '^[[:space:]]*tags:' "$WORKFLOW_FILE" \
        || warn "$WORKFLOW_FILE does not define a 'tags:' push trigger."
    if grep -q 'NPM_TOKEN' "$WORKFLOW_FILE"; then
        warn "$WORKFLOW_FILE references NPM_TOKEN — Trusted Publishing uses OIDC without NPM_TOKEN."
    fi
fi

# --- output --------------------------------------------------------------------
echo
bold "npm Trusted Publisher setup for $repo"; echo
echo "Package (from $CLI_MANIFEST): $package_name"
echo "Workflow: $WORKFLOW_FILE"
echo "Environment: $ENVIRONMENT"
echo
bold "── npmjs.com Trusted Publisher (GitHub Actions) ─────────────────"; echo
echo
echo "  1. Open: $(cyan "https://www.npmjs.com/package/${package_name}/access")"
echo "     (If the package has not been published to npm yet, publish an initial"
echo "     0.x placeholder manually or claim the name first, then open Settings ->"
echo "     Trusted Publisher on npmjs.com.)"
echo
echo "  2. Under 'Trusted Publisher', select $(bold "GitHub Actions")."
echo
echo "  3. Fill in these EXACT values:"
printf "       %-24s %s\n" "Package Name:"       "$(bold "$package_name")"
printf "       %-24s %s\n" "Organization / Owner:" "$(bold "$owner")"
printf "       %-24s %s\n" "Repository name:"    "$(bold "$repo_name")"
printf "       %-24s %s\n" "Workflow filename:"  "$(bold "$workflow_filename")"
printf "       %-24s %s\n" "Environment name:"   "$(bold "$ENVIRONMENT")"
echo
echo "  4. Save the publisher, and ensure the '$ENVIRONMENT' GitHub environment"
echo "     exists (run scripts/setup-github-environments.sh $repo) with"
echo "     required reviewers configured."
echo
echo "── After configuration ──────────────────────────────────────────"
echo
echo "  • No NPM_TOKEN secret is needed — publish.yml uses OIDC (id-token: write)."
echo "  • Merging a release-please PR pushes a v* tag and triggers publish.yml."
echo "  • If you rename the workflow, repo, package, or environment, update the"
echo "    npmjs.com Trusted Publisher entry to match."
echo
