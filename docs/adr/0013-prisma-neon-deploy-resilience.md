# ADR 0013 — Prisma Neon deploy resilience

**Status:** Accepted
**Date:** 2026-11-26
**Sprint:** S183

## Context

`prisma migrate deploy` crashed Render builds with `P1002` four times (S155 / S167 / S180 / S182). P1002 = "The database server closed the connection" during the migrate advisory-lock acquire. Each occurrence forced a manual retry via Render API; no code fix; always "transient".

Pattern is not random. Root cause is structural:

1. `DATABASE_URL` points at Neon's **pooled** endpoint (`...-pooler.neon.tech`). Pooler is pgbouncer in transaction mode. Pgbouncer serializes connection setup; under concurrent cold boots it hits a per-project connection ceiling and drops new ones.
2. Prisma migrate acquires a Postgres advisory lock before applying. Advisory locks require a **direct**, long-lived session — pgbouncer transaction-mode drops the lock at every statement boundary.
3. No `connect_timeout` set → Prisma uses the Postgres libpq default (very short). First TCP hiccup → P1002.

Four occurrences × same error × same timing window → stop treating transient.

## Decision

Three layered fixes:

### 1. `directUrl` → Neon NON-pooled

`schema.prisma` datasource gets `directUrl = env("DATABASE_URL_UNPOOLED")`. Prisma migrate, introspect, format now use the bypass URL; runtime Prisma Client still uses pooled `DATABASE_URL`.

### 2. `DATABASE_URL_UNPOOLED` DERIVED, not a separate env var

`render-build.sh` derives the direct URL from `DATABASE_URL` at build time by stripping the `-pooler` segment from the Neon host and appending `?connect_timeout=30`. The derived value is `export`ed for the Prisma CLI.

**Why derive, not add a second env var:** incident S134 — editing a single env var in the Render dashboard PUT-replaced the entire env block and wiped unrelated vars. Any env addition now carries that risk. A single `DATABASE_URL` stays the source of truth; drift between pooled and direct URLs is impossible.

`connect_timeout=30` is idempotent: if the source URL already carries it (or carries a different value), it is preserved — the function does not duplicate or override.

CI / local Postgres have no `-pooler` in the host, so the substitution is a no-op and the derived URL points at the same database. Spec: `cesta-api/scripts/render-build-url.test.sh` (5 cases).

### 3. `render-build.sh` with retry 3 retries backoff 10 / 20 / 40s

`buildCommand: bash render-build.sh`. Script wraps only the migrate deploy step in a retry loop. 1 initial attempt + 3 retries = 4 total; delays 10 / 20 / 40 seconds (70s cumulative). `npm ci`, `prisma generate`, `nest build` stay single-shot — they do not race the database.

## Consequences

**Positive:**
- Migrate uses a stable direct session. Advisory lock stays held across statements. P1002 structural root cause removed.
- Transient TCP drop / Neon cold-start masked by retry. No manual Render API retry.
- Runtime traffic unaffected — pooled URL still in use by the Prisma Client.

**Negative / trade-offs:**
- Single `DATABASE_URL` stays the source of truth; derivation in the build script eliminates env drift (avoids S134 wipe).
- Non-pooled endpoint bypasses pgbouncer; a runaway `prisma migrate` script could in theory exhaust Neon's compute connection limit. Scope is build-time only (one connection, short-lived) → acceptable.
- Max build-time penalty on worst case: 10 + 20 + 40 = 70s extra before failing out. Render free tier build quota tolerates this.
- Derivation assumes Neon URL convention (`-pooler` segment). If Neon ever changes host format, `derive_unpooled_url` and its spec fail fast.

## Follow-ups

- If a 5th P1002 occurs after S183 deploy: check Neon status page, not code. Open Neon support ticket with timing.
- If Render exposes a pre-deploy hook distinct from build, migrate deploy should move there (keeps build cacheable).
- Prisma 6+ supports `prisma migrate deploy --schema` with explicit `--url` — could drop the schema change if that lands stably.

## References

- S182 PR #139 deploy log (P1002, 3rd retry recovery).
- Memory: `project-render-api-available.md`, `project-render-deploy-stuck-s92.md` (resolved).
- Neon docs: Connection pooling, Pooler vs direct connection.
