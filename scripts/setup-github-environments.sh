#!/usr/bin/env bash
set -euo pipefail

# Create or update the GitHub Actions environments referenced by
# .github/workflows/publish.yml (`npm`) and
# .github/workflows/manual-pr-security-scan.yml (`security-review`).
#
# - `npm` deploys from `v*` tags (`push: tags: ['v*']`), so it is configured
#   with a `type=tag` deployment policy matching `v*`.
# - `security-review` gates manual PR security scans, so it is configured with
#   `type=branch` deployment policies matching `main` and `release/*`.
#
# Usage:
#   scripts/setup-github-environments.sh [owner/repo]
#
# Requires: gh CLI authenticated with admin rights (Administration: write).

ENVIRONMENTS=(npm security-review)
NPM_ALLOWED_TAGS=("v*")
SECURITY_ALLOWED_BRANCHES=(main "release/*")

usage() {
    cat <<'EOF'
Usage: scripts/setup-github-environments.sh [--help|-h] [owner/repo]

Create or update the `npm` and `security-review` GitHub Actions environments
on the target repository:
  - npm             deployment tag policy: v* (matches publish.yml tag trigger)
  - security-review deployment branch policies: main, release/*

If owner/repo is omitted, the repository is detected via `gh repo view`.
EOF
}

die() { echo "error: $*" >&2; exit 1; }

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
    repo="$1"
    [[ "$repo" =~ ^[^/]+/[^/]+$ ]] || die "repo must be in 'owner/repo' form, got: $repo"
fi

command -v gh >/dev/null 2>&1 || die "gh CLI not found. Install: https://cli.github.com/"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated. Run: gh auth login"

if [[ $# -eq 0 ]]; then
    repo="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)" \
        || die "could not detect repo; pass owner/repo as the first argument"
    [[ "$repo" =~ ^[^/]+/[^/]+$ ]] || die "repo must be in 'owner/repo' form, got: $repo"
fi

gh api "repos/$repo" >/dev/null 2>&1 \
    || die "cannot access repo '$repo' (not found, or token lacks Administration:write)"

echo "Target repo: $repo"
echo "Environments: ${ENVIRONMENTS[*]}"
echo "  npm allowed tag patterns: ${NPM_ALLOWED_TAGS[*]}"
echo "  security-review allowed branch patterns: ${SECURITY_ALLOWED_BRANCHES[*]}"
echo

upsert_environment() {
    local env="$1"
    echo "==> $env: upsert environment"
    # PUT is idempotent. custom_branch_policies=true means allowed tag/branch
    # rules are managed via the deployment-branch-policies subresource below.
    gh api --method PUT "repos/$repo/environments/$env" \
        -F "wait_timer=0" \
        -F "prevent_self_review=false" \
        -F "reviewers=[]" \
        -F "deployment_branch_policy[protected_branches]=false" \
        -F "deployment_branch_policy[custom_branch_policies]=true" \
        >/dev/null
}

reconcile_policies() {
    local env="$1"
    local existing_ids
    existing_ids="$(gh api \
        "repos/$repo/environments/$env/deployment-branch-policies" \
        -q '.branch_policies[].id' 2>/dev/null || true)"

    if [[ -n "$existing_ids" ]]; then
        echo "    clearing existing deployment policies"
        while IFS= read -r id; do
            [[ -z "$id" ]] && continue
            gh api --method DELETE \
                "repos/$repo/environments/$env/deployment-branch-policies/$id" \
                >/dev/null
        done <<< "$existing_ids"
    fi

    if [[ "$env" == "npm" ]]; then
        for pattern in "${NPM_ALLOWED_TAGS[@]}"; do
            echo "    allow tag: $pattern"
            gh api --method POST \
                "repos/$repo/environments/$env/deployment-branch-policies" \
                -f "name=$pattern" \
                -f "type=tag" \
                >/dev/null
        done
    else
        for pattern in "${SECURITY_ALLOWED_BRANCHES[@]}"; do
            echo "    allow branch: $pattern"
            gh api --method POST \
                "repos/$repo/environments/$env/deployment-branch-policies" \
                -f "name=$pattern" \
                -f "type=branch" \
                >/dev/null
        done
    fi
}

for env in "${ENVIRONMENTS[@]}"; do
    upsert_environment "$env"
    reconcile_policies "$env"
done

echo
echo "Done. Review and add required reviewers on 'npm' at:"
echo "  https://github.com/$repo/settings/environments"
