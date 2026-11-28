#!/usr/bin/env bash
# gitleaks wrapper. Single entry-point for hooks, CI, manual scans.
# Modes: --staged (commit-time, staged diff) | --range (pre-push, upstream or stdin ref tuples) | --full (full repo).

set -euo pipefail

MODE="${1:-}"
CONFIG=".gitleaks.toml"
ZERO_OID_RE='^0+$'
HEX_OID_RE='^[0-9a-fA-F]{40,64}$'

usage() {
    cat >&2 <<'EOF'
Usage: scripts/check-gitleaks.sh [--staged|--range|--full]
  --staged   Scan staged changes only (pre-commit hook mode).
  --range    Scan pushed ref tuples from git pre-push stdin (<local_ref>
             <local_oid> <remote_ref> <remote_oid>), falling back to
             <upstream>..HEAD or origin's default branch when invoked manually.
  --full     Scan full repository history (manual/audit mode).
EOF
    exit 2
}

require_gitleaks() {
    if ! command -v gitleaks >/dev/null 2>&1; then
        echo "FAIL: gitleaks not on PATH — install via just install-gitleaks (scripts/install-gitleaks.sh)" >&2
        exit 127
    fi
}

default_remote_base() {
    local base
    base=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null) || base="origin/main"
    if git rev-parse --verify --quiet "${base}" >/dev/null 2>&1; then
        printf '%s\n' "${base}"
    fi
}

scan_log_opts() {
    local log_opts="$1"
    local label="$2"
    if gitleaks detect --config "${CONFIG}" --no-banner --redact \
            --log-opts="${log_opts}"; then
        echo "PASS: no secrets in ${label}"
    else
        echo "FAIL: gitleaks found secret(s) in ${label}" >&2
        exit 1
    fi
}

scan_staged() {
    require_gitleaks
    if gitleaks protect --staged --config "${CONFIG}" --no-banner --redact; then
        echo "PASS: no secrets in staged diff"
    else
        echo "FAIL: gitleaks found secret(s) in staged diff" >&2
        exit 1
    fi
}

scan_prepush_stdin() {
    local refs_seen=0
    local default_base
    default_base=$(default_remote_base)
    local local_ref local_oid remote_ref remote_oid extra

    while IFS=' ' read -r local_ref local_oid remote_ref remote_oid extra; do
        [ -z "${local_ref:-}" ] && continue
        if [ -n "${extra:-}" ] || [ -z "${remote_oid:-}" ]; then
            continue
        fi
        if [[ ! "${local_oid}" =~ ${HEX_OID_RE} ]] || [[ ! "${remote_oid}" =~ ${HEX_OID_RE} ]]; then
            continue
        fi
        refs_seen=$((refs_seen + 1))

        # Branch/tag deletion on remote: nothing new is being published.
        if [[ "${local_oid}" =~ ${ZERO_OID_RE} ]]; then
            echo "INFO: skipping deleted ref ${remote_ref}" >&2
            continue
        fi

        local range_opts=""
        local label=""
        if [[ "${remote_oid}" =~ ${ZERO_OID_RE} ]]; then
            if [ -n "${default_base}" ] && git merge-base --is-ancestor "${default_base}" "${local_oid}" 2>/dev/null; then
                range_opts="${default_base}..${local_oid}"
                label="${local_ref} (${range_opts})"
            elif [ -n "$(git for-each-ref --count=1 refs/remotes 2>/dev/null)" ]; then
                range_opts="${local_oid} --not --remotes"
                label="${local_ref} (new commits at ${local_oid:0:12})"
            else
                range_opts="${local_oid}"
                label="${local_ref} (${local_oid:0:12})"
            fi
        elif git cat-file -e "${remote_oid}^{commit}" 2>/dev/null; then
            range_opts="${remote_oid}..${local_oid}"
            label="${local_ref} (${range_opts})"
        elif [ -n "${default_base}" ] && git merge-base --is-ancestor "${default_base}" "${local_oid}" 2>/dev/null; then
            range_opts="${default_base}..${local_oid}"
            label="${local_ref} (${range_opts})"
        else
            range_opts="${local_oid} --not --remotes"
            label="${local_ref} (${local_oid:0:12})"
        fi

        # Skip empty commit ranges (e.g. pushing an already-synced ref).
        # range_opts intentionally splits rev-list flags such as "--not --remotes".
        local commit_count
        # shellcheck disable=SC2086
        commit_count=$(git rev-list --count ${range_opts} 2>/dev/null || echo "1")
        if [ "${commit_count}" = "0" ]; then
            echo "PASS: no new commits in ${label}"
            continue
        fi

        scan_log_opts "${range_opts}" "${label}"
    done

    if [ "${refs_seen}" -gt 0 ]; then
        return 0
    fi
    return 1
}

scan_range() {
    require_gitleaks
    if [ ! -t 0 ]; then
        if scan_prepush_stdin; then
            return 0
        fi
    fi

    local base
    if base=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null); then
        : # Prefer the configured upstream tracking branch.
    else
        # No upstream (e.g. first push of a new branch): fall back to the
        # remote default branch so new commits still get a range scan.
        base=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null) || base="origin/main"
        if ! git rev-parse --verify --quiet "${base}" >/dev/null 2>&1; then
            if git rev-parse --verify --quiet HEAD >/dev/null 2>&1; then
                echo "WARN: no upstream and no '${base}' ref; falling back to full history scan" >&2
                scan_full
                return
            fi
            echo "WARN: repository has no commits; skipping range scan" >&2
            exit 0
        fi
        echo "INFO: no upstream tracking branch; scanning ${base}..HEAD instead" >&2
    fi
    scan_log_opts "${base}..HEAD" "${base}..HEAD"
}

scan_full() {
    require_gitleaks
    if gitleaks detect --config "${CONFIG}" --no-banner --redact; then
        echo "PASS: no secrets in repository"
    else
        echo "FAIL: gitleaks found secret(s) in repository" >&2
        exit 1
    fi
}

case "${MODE}" in
    --staged) scan_staged ;;
    --range)  scan_range ;;
    --full)   scan_full ;;
    *) usage ;;
esac
