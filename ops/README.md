# ops — Cesta ops scripts

On-demand operational scripts. Not part of the API or web runtime.

## render-sync-blueprint.ts

Push `cesta-api/render.yaml` into the Render dashboard so the manually
created `cesta-api` service matches blueprint intent (`buildCommand`,
`rootDir`). See **ADR 0014**.

### Usage

```bash
# dry-run (default) — prints desired vs. current, no PATCH
RENDER_API_KEY=rnd_xxx node --import tsx render-sync-blueprint.ts

# apply the diff
RENDER_API_KEY=rnd_xxx node --import tsx render-sync-blueprint.ts --apply

# optional: override service id lookup
CESTA_API_SERVICE_ID=srv_xxx RENDER_API_KEY=rnd_xxx \
  node --import tsx render-sync-blueprint.ts --apply
```

The script exits non-zero if the Render API call fails or no matching
service is found. Zero drift exits zero without PATCHing.
