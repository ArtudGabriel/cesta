# ADR 0014 — Render dashboard blueprint sync

**Status:** Accepted
**Date:** 2026-11-26
**Sprint:** S184

## Context

Sprint 183 (ADR 0013) moved `prisma migrate deploy` into
`cesta-api/render-build.sh` and set the blueprint `buildCommand` to
`bash render-build.sh`. Three deploys (S183 commits `a23263f`, `dcc5839`,
`80119f3`) failed back-to-back with:

```
Environment variable not found: DATABASE_URL_UNPOOLED
  at schema.prisma:12
prisma generate exited with P1012
```

Root cause: the `cesta-api` Render service was created **manually**, not
from `render.yaml` as a Render Blueprint. Render only auto-syncs a
`render.yaml` into a service if that service was provisioned through the
Blueprint flow. For a manually created service, `render.yaml` sits in
the repo as documentation; the dashboard retains whatever
`buildCommand` the person typed when creating the service.

The dashboard was still running the inline command from the original
scaffold:

```
cd cesta-api && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
```

`render-build.sh` was never invoked → `derive_unpooled_url` never ran →
`DATABASE_URL_UNPOOLED` was undefined at `prisma generate` time →
build crashed with P1012. CI (GitHub Actions) stayed green because the
build script spec (`render-build-url.test.sh`) only validates the shell
function in isolation; it never reaches the Render dashboard.

Three other fix shapes were weighed:

- **(b) npm script wrapper** — `build:render` in `cesta-api/package.json`
  calling `bash render-build.sh`, with dashboard still inline. Rejected:
  still requires a dashboard edit, same drift risk next time.
- **(c) re-add `DATABASE_URL_UNPOOLED` env var via API** — Boss vetoed in
  ADR 0013: incident S134 showed dashboard env-var PUT wipes the whole
  env block; the whole point of S183 was to remove that dependency.
- **(d) convert the service to a Blueprint** — Render does not support
  in-place conversion. Only path is delete + re-create, which drops the
  service id and forces all dependent URLs (CORS, WEB_URL, DNS,
  external cron keep-alives) to re-point. Too heavy for a one-shot
  drift fix.

## Decision

Introduce `ops/render-sync-blueprint.ts`, a standalone Node + tsx
script that reads `cesta-api/render.yaml`, computes the `buildCommand`
and `rootDir` the dashboard **should** carry, and `PATCH`es the Render
service through the Render REST API when drift exists.

Dry-run by default. `--apply` executes the PATCH. Service id is
resolved by name lookup (`/v1/services?name=cesta-api`) and overridable
via `CESTA_API_SERVICE_ID`. The Render API key is read from
`RENDER_API_KEY`; the operator already keeps it under
`~/.claude/secrets/render.env` (memory `project-render-api-available`).

The script lives under `ops/` with its own `package.json`, `tsconfig`,
and `node_modules`. It is not wired into CI and is **not** run during
build. It is a human-triggered sync: after merging a change that
touches `cesta-api/render.yaml`'s `buildCommand` or `rootDir`, the
operator runs the script once.

## Consequences

**Positive:**

- `render.yaml` becomes the single source of truth for `buildCommand`
  and `rootDir` on the manually created `cesta-api` service. Changes in
  the repo turn into dashboard changes through one deterministic
  command instead of a browser click path.
- Dry-run shows the diff before apply; drift is visible at a glance and
  on CI logs if pasted.
- Zero runtime impact. The script is dev tooling; the cesta-api runtime
  image never sees it.

**Negative / trade-offs:**

- Sync is still manual. If a future PR edits `render.yaml` and the
  operator forgets to run the script, the dashboard stays stale. Mitigation:
  PR template line "touched render.yaml → run ops/render-sync-blueprint.ts";
  revisit if drift recurs.
- Scope limited to `buildCommand` and `rootDir`. Env vars, health
  check path, plan, and secrets are intentionally **not** synced —
  those still carry the S134 PUT-wipe risk. Expanding the script to
  env vars needs a separate design pass (Render API `PUT /env-vars` is
  destructive; `POST /env-vars` additive).
- Introduces `ops/` as a new top-level folder with its own dependency
  tree. Small (`yaml`, `tsx`, `typescript`); accepted.

## Rollback

Captured 2026-11-26 before S184 PATCH, on service
`srv-dbst4muc6qcc73a3opr0` (dashboard name `cesta`).

**Pre-sync `serviceDetails.envSpecificDetails.buildCommand`:**

```
cd cesta-api && npm ci --include=dev && npx prisma generate && npx prisma migrate deploy && npm run build
```

**Pre-sync `serviceDetails.envSpecificDetails.startCommand`** (untouched,
recorded for verification):

```
cd cesta-api && node dist/src/main.js
```

**Pre-sync `rootDir`** (untouched, recorded for verification): `""`
(empty; repo root).

To revert S184: `PATCH /v1/services/srv-dbst4muc6qcc73a3opr0`
`{serviceDetails: {envSpecificDetails: {buildCommand: "<string above>"}}}`.
Only `buildCommand` was changed, so no other field needs restoring.

## Boss guard (S184)

- The script PATCHes `serviceDetails.envSpecificDetails.buildCommand`
  **and nothing else**. `rootDir`, env vars, plan, health check, and
  secrets stay untouched — they still carry the S134 PUT-wipe risk.
- The script re-GETs the service after PATCH and aborts (non-zero exit)
  if any field other than `buildCommand` changed. The
  rollback command above is the recovery path.
- The dashboard service is named `cesta`, not `cesta-api`. Blueprint
  name-based lookup fails and is intentional: the operator must pass
  `CESTA_API_SERVICE_ID=srv-dbst4muc6qcc73a3opr0`, which forces a
  conscious choice of target service.
- The blueprint declares `rootDir: cesta-api`. Because the dashboard
  `rootDir` stays empty (and must — Boss guard), the script composes
  the dashboard `buildCommand` as `cd ${rootDir} && ${buildCommand}`
  so the script runs from the right folder without a `rootDir` PATCH.

## Follow-ups

- If Render adds a "convert to Blueprint" action on existing services,
  retire this script.
- If a 2nd script lands under `ops/`, document a shared pattern
  (env var loading, dry-run flag, exit codes).
- Memory entry pointing future terminals at `ops/README.md`.

## Sprint 185 cleanup

Reviewer gate 3 on S184 (PR #143) flagged three P3 nits; all three
landed on S185:

- **`findServiceId` removed.** The dashboard service name is `cesta`,
  the blueprint name is `cesta-api`; the name-based lookup always
  failed and was dead code. `CESTA_API_SERVICE_ID` is now required
  (previously optional-override). Fail-fast when absent.
- **TypeScript + `@types/node` pinned to stable mainstream.**
  `typescript ^5.7` and `@types/node ^22` replace the pre-release
  `^7.0.2` and non-existent `^26.6.11` that `npm install` produced.
- **Double-cd guard.** `desiredBuildCommand(bp, dashboardRootDir)`
  aborts if the dashboard `rootDir` is set to a value other than the
  blueprint `rootDir`; composing `cd ${rootDir} && ...` while the
  dashboard also `cd`s first would land the build in
  `cesta-api/cesta-api/`.

## References

- ADR 0013 — Prisma Neon deploy resilience (the change this script
  exists to propagate).
- S183 PR #140 / #141 / #142 build failure logs.
- Render REST API: `GET /v1/services`, `PATCH /v1/services/{id}`.
- Memory `project-render-api-available.md`.
