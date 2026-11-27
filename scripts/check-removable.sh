#!/bin/sh
# Prove apps can be deleted and the rest still works (D-040/D-042,
# docs/reference/boundary-rules.md "Removing an app"). Copies the repo
# (tracked + unignored files only) to a temp dir, deletes each apps/<app>
# given, then checks the core on its own and the root tooling without them:
#   core typecheck, core tests, core boundaries, just lint/typecheck/
#   check-boundaries. Exits non-zero if any step fails; always cleans up.
# Several apps are removed together when one depends on another: apps/web
# uses the API's router type, so removing the API means `api web` (D-054).
# Usage: scripts/check-removable.sh <app> [<app>...]   (e.g. cli, or api web)
set -eu

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <app> [<app>...]   (apps/ folder names, e.g. cli, or api web)" >&2
  exit 2
fi

root="$(git rev-parse --show-toplevel)"
for app in "$@"; do
  case "$app" in
    '' | *[!a-z0-9-]*)
      echo "usage: $0 <app> [<app>...]   (apps/ folder names, e.g. cli, or api web)" >&2
      exit 2
      ;;
  esac
  if [ ! -d "$root/apps/$app" ]; then
    echo "apps/$app does not exist" >&2
    exit 2
  fi
done
# "apps/api apps/web", for the messages.
apps="$(printf 'apps/%s ' "$@" | sed 's/ $//')"

scratch="$(mktemp -d "${TMPDIR:-/tmp}/check-removable.XXXXXX")"
trap 'rm -rf "$scratch"' EXIT INT TERM

step() {
  printf '\n==> %s\n' "$1"
}

step "copy the repo to $scratch (without node_modules)"
cd "$root"
git ls-files --cached --others --exclude-standard | while IFS= read -r file; do
  # Skip tracked files deleted in the working tree.
  [ -e "$file" ] || continue
  mkdir -p "$scratch/$(dirname "$file")"
  cp -p "$file" "$scratch/$file"
done

for app in "$@"; do
  step "delete apps/$app"
  rm -rf "$scratch/apps/$app"
done
rmdir "$scratch/apps" 2>/dev/null || true

cd "$scratch"
# A fresh git repo: the prepare script (lefthook install) and check-shell
# (git ls-files) both need one.
git init -q
git add -A

step "install (the lockfile still lists $apps, so it is updated)"
pnpm install --no-frozen-lockfile --prefer-offline

step "core: typecheck"
pnpm exec tsc --noEmit -p packages/core/tsconfig.json

step "core: tests"
pnpm exec vitest run --project core

step "core: boundaries"
pnpm exec depcruise packages --config .dependency-cruiser.cjs --output-type err-long

step "root tooling without $apps: lint, typecheck, check-boundaries"
just lint
just typecheck
just check-boundaries

printf '\nOK: the repo still works without %s\n' "$apps"
