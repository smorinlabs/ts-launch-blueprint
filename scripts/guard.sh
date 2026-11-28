#!/usr/bin/env bash
# scripts/guard.sh — fork guard, two modes:
#   guard.sh warn   → Tier 1: one-line stderr banner, always exit 0
#   guard.sh block  → Tier 2: full message + exit 1
#
# Warns/blocks clones still wearing the template's identity. It survives
# child generation because it protects FORKS at runtime, while `press verify`
# protects the TEMPLATE in CI — different jobs.
#
# Shared skip conditions (any one of them silences both modes):
#   1. press/press-receipt.toml exists   → stamped by template-press
#   2. .blueprint-contributor exists     → local opt-out for maintainers
#   3. origin URL (normalized) matches the canonical blueprint repo
#
# POSIX-y bash; no Node, no pnpm. Hot path: runs before `just setup` on a bare clone.

set -u

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
receipt="${repo_root}/press/press-receipt.toml"
contributor="${repo_root}/.blueprint-contributor"

# Canonical blueprint owner/repo pairs. Include legacy owner prefix (`smorin/`)
# so clones created before the org move still get a silent guard.
blueprint_owner_repos="smorinlabs/ts-launch-blueprint smorin/ts-launch-blueprint"

parse_origin() {
    # Echoes "owner/repo" with trailing .git stripped; empty if no origin or invalid.
    url="$(git -C "${repo_root}" remote get-url origin 2>/dev/null)" || return 0
    [ -n "$url" ] || return 0
    printf '%s' "$url" \
        | sed -E 's#^(https?://github\.com/|git@github\.com:)([^/]+)/([^/]+)$#\2/\3#' \
        | sed -E 's#\.git$##'
}

origin_matches_blueprint() {
    parsed="$(parse_origin)"
    [ -n "$parsed" ] || return 1
    for blue in $blueprint_owner_repos; do
        [ "$parsed" = "$blue" ] && return 0
    done
    return 1
}

should_skip() {
    [ -f "$receipt" ] && return 0
    [ -f "$contributor" ] && return 0
    origin_matches_blueprint && return 0
    return 1
}

mode="${1:-warn}"

case "$mode" in
    warn)
        if ! should_skip; then
            # One-line banner. ALWAYS exit 0 — a non-zero exit from a `just`
            # `shell()` call aborts the recipe, which would turn Tier 1
            # into Tier 2.
            printf >&2 "\033[33m⚠  blueprint un-initialized — rebrand with \`uvx --from template-press==5.0.0 press rebrand\` (see docs/tutorials/full-project-setup.md).\033[0m\n"
        fi
        exit 0
        ;;
    block)
        if should_skip; then
            exit 0
        fi
        cat >&2 <<'EOF'

  ───────────────────────────────────────────────────────────────────────
  ⛔  This recipe is blocked until the project is initialized.

  You are running a recipe that produces a wrong artifact, an external
  side effect, or an identity-bearing write — but this project still
  carries the ts-launch-blueprint identity (package name, repo name,
  CLI command, copyright holder, URLs).

  Run one of:
      uvx --from template-press==5.0.0 press rebrand --target . --config ../press-answers.toml
      (dry-run first: add --dry-run; see docs/tutorials/full-project-setup.md)

  Escape hatches:
      • If you forked the blueprint to contribute back, create
        .blueprint-contributor at the repo root (git-ignored) to
        silence this guard.
      • If your origin is set to the blueprint repo, the guard already
        skips automatically.
  ───────────────────────────────────────────────────────────────────────

EOF
        exit 1
        ;;
    *)
        printf >&2 'guard.sh: unknown mode %s (expected: warn | block)\n' "$mode"
        exit 2
        ;;
esac
