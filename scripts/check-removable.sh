#!/bin/sh
# Prove an app can be deleted and the rest still works (D-040/D-042,
# docs/reference/boundary-rules.md "Removing the CLI"). Copies the repo
# (tracked + unignored files only) to a temp dir, deletes apps/<app>, then
# checks the core on its own and the root tooling without the app:
#   core typecheck, core tests, core boundaries, just lint/typecheck/
#   check-boundaries. Exits non-zero if any step fails; always cleans up.
# Usage: scripts/check-removable.sh <app>   (e.g. cli)
set -eu

app="${1:-}"
case "$app" in
  '' | *[!a-z0-9-]*)
    echo "usage: $0 <app>   (an apps/ folder name, e.g. cli)" >&2
    exit 2
    ;;
esac

root="$(git rev-parse --show-toplevel)"
if [ ! -d "$root/apps/$app" ]; then
  echo "apps/$app does not exist" >&2
  exit 2
fi

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

step "delete apps/$app"
rm -rf "$scratch/apps/$app"
rmdir "$scratch/apps" 2>/dev/null || true

cd "$scratch"
# A fresh git repo: the prepare script (lefthook install) and check-shell
# (git ls-files) both need one.
git init -q
git add -A

step "install (the lockfile still lists apps/$app, so it is updated)"
pnpm install --no-frozen-lockfile --prefer-offline

step "core: typecheck"
pnpm exec tsc --noEmit -p packages/core/tsconfig.json

step "core: tests"
pnpm exec vitest run --project core

step "core: boundaries"
pnpm exec depcruise packages --config .dependency-cruiser.cjs --output-type err-long

step "root tooling without apps/$app: lint, typecheck, check-boundaries"
just lint
just typecheck
just check-boundaries

printf '\nOK: the repo still works without apps/%s\n' "$app"
