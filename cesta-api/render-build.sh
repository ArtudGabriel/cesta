#!/usr/bin/env bash
# Render build script — Cesta API
# Sprint 183 (ADR 0013): prisma migrate deploy wrapped in retry 3x
# backoff 10s/20s/40s to survive transient P1002 (Neon pooler
# connection ceiling / advisory-lock contention) during cold build.
#
# DATABASE_URL_UNPOOLED is DERIVED from DATABASE_URL (strip "-pooler")
# instead of being set as a separate env var. Prevents incident S134
# (dashboard PUT wiping all vars when editing individually).
set -euo pipefail

# Derive directUrl for prisma migrate. Neon pooled host carries "-pooler"
# in the subdomain (ep-xxx-pooler.region.aws.neon.tech); stripping it
# gives the direct endpoint. CI / local Postgres have no "-pooler" →
# substitution is a no-op (same URL).
derive_unpooled_url() {
  local src="$1"
  local base="${src//-pooler/}"
  if [[ "$base" == *"connect_timeout="* ]]; then
    printf '%s' "$base"
  elif [[ "$base" == *"?"* ]]; then
    printf '%s&connect_timeout=30' "$base"
  else
    printf '%s?connect_timeout=30' "$base"
  fi
}

main() {
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "!!! DATABASE_URL not set — aborting build"
    exit 1
  fi

  export DATABASE_URL_UNPOOLED
  DATABASE_URL_UNPOOLED="$(derive_unpooled_url "$DATABASE_URL")"
  echo ">>> derived DATABASE_URL_UNPOOLED (host stripped of -pooler, connect_timeout=30)"

  echo ">>> npm ci"
  npm ci

  echo ">>> prisma generate"
  npx prisma generate

  echo ">>> prisma migrate deploy (retry 3x, backoff 10/20/40s)"
  local attempt=0
  local delays=(10 20 40)
  until npx prisma migrate deploy; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 4 ]; then
      echo "!!! migrate deploy failed after 4 attempts — aborting build"
      exit 1
    fi
    local delay=${delays[$((attempt - 1))]}
    echo "--- migrate deploy attempt $attempt failed; sleeping ${delay}s before retry"
    sleep "$delay"
  done

  echo ">>> nest build"
  npm run build
}

# Run main only when executed directly (not when sourced from tests).
if [ "${BASH_SOURCE[0]:-$0}" = "$0" ]; then
  main "$@"
fi
