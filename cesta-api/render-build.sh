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

  echo ">>> npm ci --include=dev"
  # NODE_ENV=production on Render → npm ci omits devDependencies by default.
  # @nestjs/cli lives in devDependencies; without --include=dev the "nest build"
  # step below fails with "sh: 1: nest: not found" (seen on dep-dc41p38u01pc73ekeftg).
  npm ci --include=dev

  echo ">>> prisma generate"
  npx prisma generate

  echo ">>> prisma migrate deploy (retry 3x, backoff 10/20/40s)"
  local attempt=0
  local delays=(10 20 40)
  local migrate_log
  migrate_log="$(mktemp)"
  until npx prisma migrate deploy 2>&1 | tee "$migrate_log"; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 4 ]; then
      echo "!!! migrate deploy failed after 4 attempts — aborting build"
      rm -f "$migrate_log"
      exit 1
    fi
    local delay=${delays[$((attempt - 1))]}
    local delay_ms=$((delay * 1000))
    # Sprint 188 G2: observability do retry logic ADR 0013.
    # Extract Prisma error code (P1002, P1012, P1017, ...) do log se presente;
    # fallback "unknown" quando o erro não casa o pattern.
    local error_code
    error_code="$(grep -oE 'P1[0-9]{3}' "$migrate_log" | head -n1 || true)"
    error_code="${error_code:-unknown}"
    echo "--- migrate deploy attempt $attempt failed (code=$error_code); sleeping ${delay}s before retry"
    # Report attempt (structured JSON log + optional Sentry event). Non-fatal.
    node scripts/report-migrate-attempt.mjs \
      --attempt "$attempt" \
      --error-code "$error_code" \
      --backoff-ms "$delay_ms" || true
    : > "$migrate_log"
    sleep "$delay"
  done
  rm -f "$migrate_log"

  echo ">>> nest build"
  npm run build
}

# Run main only when executed directly (not when sourced from tests).
if [ "${BASH_SOURCE[0]:-$0}" = "$0" ]; then
  main "$@"
fi
