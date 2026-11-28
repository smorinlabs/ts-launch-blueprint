#!/bin/sh
# Prove apps can be deleted and the rest still works (D-040/D-042, ADR 0017,
# docs/reference/boundary-rules.md "Removing an app"). Copies the repo
# (tracked + unignored files only) to a temp dir, deletes each apps/<app>
# given, then checks the core on its own (typecheck, tests, boundaries, and
# standalone library build + pack-check-core) and the root tooling without them:
#   just lint, just typecheck, just check-boundaries, just build.
# Exits non-zero if any step fails; always cleans up.
# Several apps are removed together when one depends on another: apps/web
# uses the API's router type, so removing the API means `api web` (D-054).
# Passing `cli api web` deletes all apps and proves packages/core works as a
# pure standalone library.
# Usage: scripts/check-removable.sh <app> [<app>...]   (e.g. cli, api web, or cli api web)
set -eu

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <app> [<app>...]   (apps/ folder names, e.g. cli, api web, or cli api web)" >&2
  exit 2
fi

root="$(git rev-parse --show-toplevel)"
for app in "$@"; do
  case "$app" in
    '' | *[!a-z0-9-]*)
      echo "usage: $0 <app> [<app>...]   (apps/ folder names, e.g. cli, api web, or cli api web)" >&2
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
  # Skip tracked files deleted in the working tree (keep symlinks intact).
  [ -e "$file" ] || [ -L "$file" ] || continue
  mkdir -p "$scratch/$(dirname "$file")"
  cp -pP "$file" "$scratch/$file"
done
if [ -f "$root/.blueprint-contributor" ]; then
  cp -p "$root/.blueprint-contributor" "$scratch/.blueprint-contributor"
fi

for app in "$@"; do
  step "delete apps/$app"
  rm -rf "$scratch/apps/$app"
done
rmdir "$scratch/apps" 2>/dev/null || true

origin_url="$(git -C "$root" remote get-url origin 2>/dev/null || true)"

cd "$scratch"
# A fresh git repo: the prepare script (lefthook install), check-shell
# (git ls-files), and guard.sh (origin check) all inspect git metadata.
git init -q
if [ -n "$origin_url" ]; then
  git remote add origin "$origin_url"
fi
git add -A

step "install (the lockfile still lists $apps, so it is updated)"
pnpm install --no-frozen-lockfile --prefer-offline --ignore-scripts

step "core: typecheck"
pnpm exec tsc --noEmit -p packages/core/tsconfig.json

step "core: tests"
pnpm exec vitest run --project core

step "core: boundaries"
pnpm exec depcruise packages --config .dependency-cruiser.cjs --output-type err-long

step "core: standalone library build + pack-check"
just pack-check-core

step "root tooling without $apps: lint, typecheck, check-boundaries, build"
just lint
just typecheck
just check-boundaries
just build

printf '\nOK: the repo still works without %s\n' "$apps"
