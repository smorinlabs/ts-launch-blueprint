#!/bin/sh
# Devcontainer setup — the two-level flow:
#   Level 1: make bootstrap  (base toolchain: node >=24, pnpm 10, just)
#   Level 2: just setup      (dev env sync, git hooks, hook toolchain)
set -eu

if ! command -v make >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1 || ! command -v git >/dev/null 2>&1; then
    if [ "$(id -u)" -eq 0 ]; then
        apt-get update -qq
        apt-get install -y -qq --no-install-recommends make curl ca-certificates git
    elif command -v sudo >/dev/null 2>&1; then
        sudo apt-get update -qq
        sudo apt-get install -y -qq --no-install-recommends make curl ca-certificates git
    else
        echo "FAIL: make, curl, or git missing and sudo/root unavailable" >&2
        exit 1
    fi
fi

export PATH="$HOME/.local/bin:$PATH"
make bootstrap
just setup
