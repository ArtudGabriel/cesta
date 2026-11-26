#!/usr/bin/env bash
# Spec: cesta-api/scripts/report-migrate-attempt.mjs (S188 ADR 0013 obs)
# Run: bash scripts/report-migrate-attempt.test.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER="$SCRIPT_DIR/report-migrate-attempt.mjs"

pass=0
fail=0

assert_contains() {
  local haystack="$1" needle="$2" name="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "OK   : $name"
    pass=$((pass + 1))
  else
    echo "FAIL : $name"
    echo "       expected substring: $needle"
    echo "       actual:             $haystack"
    fail=$((fail + 1))
  fi
}

# Ensure SENTRY_DSN unset so sendSentry branch returns { sent: false } and
# we only assert on the structured JSON log line (stdout).
unset SENTRY_DSN

# 1) Full flags → JSON payload has expected keys
out="$(node "$HELPER" --attempt 1 --error-code P1002 --backoff-ms 10000 2>/dev/null)"
assert_contains "$out" '"event":"migrate_deploy_retry"' 'event key present'
assert_contains "$out" '"attempt_number":1'             'attempt_number int'
assert_contains "$out" '"error_code":"P1002"'           'error_code string'
assert_contains "$out" '"backoff_ms":10000'             'backoff_ms int'
assert_contains "$out" '"sprint":"S188"'                'sprint tag'
assert_contains "$out" '"adr":"0013"'                   'adr tag'

# 2) Missing flags → defaults applied
out2="$(node "$HELPER" 2>/dev/null)"
assert_contains "$out2" '"attempt_number":0'    'default attempt=0'
assert_contains "$out2" '"error_code":"unknown"' 'default error_code=unknown'
assert_contains "$out2" '"backoff_ms":0'        'default backoff_ms=0'

# 3) Exit code is always 0 even on bad args (never derruba build)
node "$HELPER" --attempt notanumber --error-code '' --backoff-ms NaN >/dev/null 2>&1
rc=$?
if [ "$rc" = "0" ]; then
  echo "OK   : exit 0 on bad args"
  pass=$((pass + 1))
else
  echo "FAIL : exit $rc on bad args (expected 0)"
  fail=$((fail + 1))
fi

echo
echo "Passed: $pass"
echo "Failed: $fail"
if [ "$fail" -gt 0 ]; then
  exit 1
fi
