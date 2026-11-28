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
command -v node >/dev/null 2>&1 || die "node is required to build environment payloads"
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

build_env_payload() {
    local existing_json="${1:-}"
    ENV_JSON="$existing_json" node -e '
const raw = process.env.ENV_JSON || "";
let waitTimer = 0;
let preventSelfReview = false;
let reviewers = [];

if (raw.trim() !== "") {
  const env = JSON.parse(raw);
  const rules = Array.isArray(env.protection_rules) ? env.protection_rules : [];
  const waitRule = rules.find((r) => r && r.type === "wait_timer");
  const revRule = rules.find((r) => r && r.type === "required_reviewers");

  if (waitRule && typeof waitRule.wait_timer === "number") {
    waitTimer = waitRule.wait_timer;
  } else if (typeof env.wait_timer === "number") {
    waitTimer = env.wait_timer;
  }

  if (revRule && typeof revRule.prevent_self_review === "boolean") {
    preventSelfReview = revRule.prevent_self_review;
  } else if (typeof env.prevent_self_review === "boolean") {
    preventSelfReview = env.prevent_self_review;
  }

  const rawReviewers = Array.isArray(revRule && revRule.reviewers)
    ? revRule.reviewers
    : (Array.isArray(env.reviewers) ? env.reviewers : []);
  reviewers = rawReviewers
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const type = entry.type;
      const id = entry.reviewer && typeof entry.reviewer.id === "number"
        ? entry.reviewer.id
        : entry.id;
      if ((type === "User" || type === "Team") && typeof id === "number") {
        return { type, id };
      }
      return null;
    })
    .filter(Boolean);
}

process.stdout.write(JSON.stringify({
  wait_timer: waitTimer,
  prevent_self_review: preventSelfReview,
  reviewers,
  deployment_branch_policy: {
    protected_branches: false,
    custom_branch_policies: true,
  },
}));
'
}

upsert_environment() {
    local env="$1"
    local get_out="" get_status=0 put_payload=""
    echo "==> $env: upsert environment"
    # Preserve existing protection rules (wait_timer, prevent_self_review,
    # reviewers) when the environment already exists (HTTP 200); only send
    # creation defaults on HTTP 404. custom_branch_policies=true means allowed
    # tag/branch rules are managed via the deployment-branch-policies subresource below.
    if get_out="$(gh api "repos/$repo/environments/$env" 2>&1)"; then
        put_payload="$(build_env_payload "$get_out")" \
            || die "failed to parse existing environment '$env' response"
    else
        get_status=$?
        if [[ "$get_out" == *"HTTP 404"* || "$get_out" == *'"status": "404"'* || "$get_out" == *'"status":"404"'* ]]; then
            put_payload="$(build_env_payload "")"
        else
            die "failed to inspect environment '$env' (exit $get_status): $get_out"
        fi
    fi

    printf '%s' "$put_payload" | gh api --method PUT "repos/$repo/environments/$env" \
        --input - \
        >/dev/null
}

reconcile_policies() {
    local env="$1"
    local existing_ids
    if ! existing_ids="$(gh api --paginate \
        "repos/$repo/environments/$env/deployment-branch-policies" \
        -q '.branch_policies[].id')"; then
        die "failed to list deployment branch policies for '$env'"
    fi

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
