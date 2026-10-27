#!/bin/sh
# Smoke-test a running API (D-050): the CI api-image job and the Cloud Run
# deploy run the same checks. POSIX sh + curl only (no jq).
# Usage: scripts/smoke-api.sh <base-url> [healthz-retries]
#   e.g. scripts/smoke-api.sh http://localhost:8080 10
set -eu

base="${1:-}"
retries="${2:-10}"
if [ -z "$base" ]; then
  echo "usage: $0 <base-url> [healthz-retries]" >&2
  exit 2
fi
base="${base%/}"
# {"workspaceName":"nope"}, URL-encoded.
unknown_workspace='%7B%22workspaceName%22%3A%22nope%22%7D'

body_file="$(mktemp "${TMPDIR:-/tmp}/smoke-api.XXXXXX")"
trap 'rm -f "$body_file"' EXIT

# GET a path; prints the HTTP status (000 when the server can't be reached:
# curl's -w still prints it), leaves the body in $body_file.
fetch() {
  curl -s -o "$body_file" -w '%{http_code}' "$base$1" || true
}

pass() { printf 'PASS  %s\n' "$1"; }
fail() {
  printf 'FAIL  %s\n' "$1"
  exit 1
}

# expect_status <label> <expected> <path>: GET path, check the status only.
expect_status() {
  got="$(fetch "$3")"
  if [ "$got" = "$2" ]; then
    pass "$1 -> $2"
  else
    fail "$1 -> $got (expected $2)"
  fi
}

# 1. /healthz, retried while a fresh container starts.
attempt=1
while :; do
  status="$(fetch /healthz)"
  if [ "$status" = 200 ] || [ "$attempt" -ge "$retries" ]; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done
if [ "$status" = 200 ] && grep -q '"status":"ok"' "$body_file"; then
  pass "GET /healthz -> 200 {\"status\":\"ok\"}"
else
  fail "GET /healthz -> $status (expected 200 {\"status\":\"ok\"})"
fi

# 2. /readyz.
expect_status "GET /readyz" 200 /readyz

# 3. projects.list: the demo data, including project p-4.
status="$(fetch /trpc/projects.list)"
if [ "$status" = 200 ] && grep -q '"projects":\[' "$body_file" && grep -q '"id":"p-4"' "$body_file"; then
  pass "GET /trpc/projects.list -> 200 with the demo projects"
else
  fail "GET /trpc/projects.list -> $status (expected 200 with \"projects\":[ and p-4)"
fi

# 4. An unknown workspace is a 404 (domain-error mapping, D-049).
expect_status "GET projects.list (unknown workspace)" 404 "/trpc/projects.list?input=$unknown_workspace"

# 5. An unknown path is a 404.
expect_status "GET /nope" 404 /nope

# 6. /metrics, on by default (METRICS_ENABLED, D-052).
status="$(fetch /metrics)"
if [ "$status" = 200 ] && grep -q '^http_requests_total' "$body_file"; then
  pass "GET /metrics -> 200 with http_requests_total"
else
  fail "GET /metrics -> $status (expected 200 with http_requests_total)"
fi
