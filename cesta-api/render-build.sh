#!/usr/bin/env bash
# Render build script — Cesta API
# Sprint 183 (ADR 0013): prisma migrate deploy wrapped in retry 3x
# backoff 10s/20s/40s to survive transient P1002 (Neon pooler
# connection ceiling / advisory-lock contention) during cold build.
set -euo pipefail

echo ">>> npm ci"
npm ci

echo ">>> prisma generate"
npx prisma generate

migrate_deploy() {
  npx prisma migrate deploy
}

echo ">>> prisma migrate deploy (retry 3x, backoff 10/20/40s)"
attempt=0
delays=(10 20 40)
until migrate_deploy; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 3 ]; then
    echo "!!! migrate deploy failed after 3 attempts — aborting build"
    exit 1
  fi
  delay=${delays[$((attempt - 1))]}
  echo "--- migrate deploy attempt $attempt failed; sleeping ${delay}s before retry"
  sleep "$delay"
done

echo ">>> nest build"
npm run build
