#!/usr/bin/env bash
# Spec: derive_unpooled_url (cesta-api/render-build.sh, S183 ADR 0013)
# Run: bash scripts/render-build-url.test.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Source without triggering main() — the file guards on BASH_SOURCE != $0.
# shellcheck disable=SC1091
source "$SCRIPT_DIR/render-build.sh"

pass=0
fail=0

assert_eq() {
  local actual="$1" expected="$2" name="$3"
  if [ "$actual" = "$expected" ]; then
    echo "OK   : $name"
    pass=$((pass + 1))
  else
    echo "FAIL : $name"
    echo "       expected: $expected"
    echo "       actual:   $actual"
    fail=$((fail + 1))
  fi
}

# 1) Neon pooled URL → strip -pooler, add connect_timeout
actual="$(derive_unpooled_url 'postgres://u:p@ep-abc-pooler.us-east-2.aws.neon.tech/db?sslmode=require')"
assert_eq "$actual" \
  'postgres://u:p@ep-abc.us-east-2.aws.neon.tech/db?sslmode=require&connect_timeout=30' \
  'neon pooled URL with query string'

# 2) Neon direct URL (no -pooler) → unchanged host, add connect_timeout
actual="$(derive_unpooled_url 'postgres://u:p@ep-abc.us-east-2.aws.neon.tech/db?sslmode=require')"
assert_eq "$actual" \
  'postgres://u:p@ep-abc.us-east-2.aws.neon.tech/db?sslmode=require&connect_timeout=30' \
  'neon direct URL (no-op strip) with query string'

# 3) Plain Postgres (CI / local), no query string → append ?connect_timeout
actual="$(derive_unpooled_url 'postgresql://postgres:postgres@localhost:5432/cesta_test')"
assert_eq "$actual" \
  'postgresql://postgres:postgres@localhost:5432/cesta_test?connect_timeout=30' \
  'local URL without query string'

# 4) URL already carrying connect_timeout → idempotent (no duplicate)
actual="$(derive_unpooled_url 'postgres://u:p@ep-abc.region.aws.neon.tech/db?sslmode=require&connect_timeout=30')"
assert_eq "$actual" \
  'postgres://u:p@ep-abc.region.aws.neon.tech/db?sslmode=require&connect_timeout=30' \
  'idempotent when connect_timeout already present'

# 5) Pooled URL already carrying connect_timeout → strip -pooler, keep timeout
actual="$(derive_unpooled_url 'postgres://u:p@ep-abc-pooler.region.aws.neon.tech/db?sslmode=require&connect_timeout=15')"
assert_eq "$actual" \
  'postgres://u:p@ep-abc.region.aws.neon.tech/db?sslmode=require&connect_timeout=15' \
  'strip -pooler without overriding existing connect_timeout'

echo
echo "pass=$pass fail=$fail"
exit "$fail"
