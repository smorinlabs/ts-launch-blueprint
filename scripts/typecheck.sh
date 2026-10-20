#!/bin/sh
# Typecheck the whole workspace (D-048). Pass 1: the root tsconfig.json, which
# keeps isolatedDeclarations for the core and the published CLI and excludes
# any app that can't use it. Pass 2: each apps/*/tsconfig.json that turns
# isolatedDeclarations off (today apps/api: tRPC router types can't be
# written out by hand). Apps are found by glob, so deleting one never breaks
# this script (just check-removable).
set -eu

cd "$(dirname "$0")/.."

echo "  tsc --noEmit"
pnpm exec tsc --noEmit

for config in apps/*/tsconfig.json; do
  [ -f "$config" ] || continue
  if grep -q '"isolatedDeclarations": false' "$config"; then
    echo "  tsc --noEmit -p $(dirname "$config")"
    pnpm exec tsc --noEmit -p "$(dirname "$config")"
  fi
done
