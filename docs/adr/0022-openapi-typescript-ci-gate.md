# ADR 0022 — openapi-typescript CI gate (S209)

- **Date:** 2026-11-26
- **Status:** Accepted
- **Related:** [ADR 0021](./0021-openapi-swagger-scope.md), `cesta-api/scripts/dump-openapi.ts`, `cesta-web/scripts/generate-api-types.mjs`, `.github/workflows/ci.yml` (job `api`).

## Context

ADR 0021 fechou com 17/17 controllers Swagger-documented (S204 → S208). `/api/docs-json` serve o spec OpenAPI canônico. S209 destrava a próxima etapa: converter o spec em types TypeScript consumíveis pelo frontend + impedir drift silencioso entre schema backend e código frontend.

Problema concreto deixado em aberto por S201 (ver README "S201 trade-off + follow-up OpenAPI contract check CI"): mocks Playwright de rota podem divergir do shape real sem CI sinal. Types gerados do spec + CI gate garantem que qualquer mudança na API aparece como diff rastreável no PR.

## Decision

### Pipeline

1. **`cesta-api/scripts/dump-openapi.ts`** (ts-node). Bootstrapa `AppModule` offline (sem `app.listen`), força env defaults seguros (`CESTA_OPENAPI_DUMP=1`, DB/R2/Redis/2FA/JWT dummy) e escreve o spec JSON via `SwaggerModule.createDocument` → stdout ou argv[2] path. `PrismaService.onModuleInit` + `onModuleDestroy` fazem skip de `$connect`/`$disconnect` quando `CESTA_OPENAPI_DUMP=1` pra permitir dump local sem Postgres rodando.

2. **`cesta-web/scripts/generate-api-types.mjs`** (Node ESM). Dois modos:
   - **default (write):** dumpa spec (`npm --prefix ../cesta-api run openapi:dump`) OU reusa via `--from <path>`, roda `openapi-typescript` CLI, sobrescreve baseline committed em `src/types/generated/api.baseline.d.ts`. Dev confere `git diff` e commita.
   - **`--check`:** regera candidate, normaliza (CRLF/LF + trailing whitespace + newline final), compara via `computeDrift` byte-level vs baseline committed. Exit 1 com diff compacto (40 linhas truncadas) se divergiu.

3. **CI gate** em `.github/workflows/ci.yml` job `api` pós `npm run build`:
   - `npm run openapi:dump -- /tmp/openapi.json` (DB + Redis já disponíveis via services).
   - `cd ../cesta-web && npm install --no-save openapi-typescript && node scripts/generate-api-types.mjs --check --from /tmp/openapi.json`. Instalação on-demand (sem `npm ci` full de cesta-web) mantém job fast (~10s overhead).

### Baseline única committed

- **`cesta-web/src/types/generated/api.baseline.d.ts`** é a única source of truth committed.
- `cesta-web/src/types/generated/.gitignore` exclui qualquer outro arquivo em `generated/` (scratch regen inside tmpdir).
- Decisão vs "commitar spec JSON + types": só types; spec JSON é produzível on-demand do `cesta-api` e não agrega valor como artifact (apenas aumenta diff noise em PRs).

### Drift policy

- **Não-breaking** (novo endpoint, campo opcional novo): dev roda `npm run types:api`, inspeciona diff, commita baseline junto com o PR da API. CI passa automático.
- **Breaking** (rename, type mudado, path removed): dev atualiza ADR 0022 (seção "Breaking history") ou abre ADR dedicado, cita no corpo do PR qual consumer migrou.
- **Drift detectado em PR sem baseline update:** CI falha em `types:api:check` com diff compacto. Mensagem aponta pra `npm run types:api` + commit do baseline atualizado.

## Trade-offs

**Alternativas consideradas:**

1. **Commit do spec JSON + types** (dupla baseline): rejeitado. Dobra diff noise em PRs sem ganho — spec é derivável do código em qualquer ponto; divergência spec ↔ código seria detectada por `dump-openapi` + diff no próprio PR da API (não precisa commit).
2. **Full re-gen cada CI run sem baseline committed**: rejeitado. Sem baseline committed, não há diff a inspecionar no PR; devs precisariam baixar artifact pra ver mudança.
3. **Types dentro de `cesta-api` + re-exportados**: rejeitado. Mantém separation of concerns — types são contrato consumido pelo frontend; ownership no `cesta-web/src/types/generated/`.
4. **Dedicated CI job** (parallel to api/web): rejeitado. Overhead de novo setup-node + postgres service pelo mesmo gate que pode viver no job `api` existente (~10s extra vs ~90s novo job).
5. **npx openapi-typescript on-demand sem npm install no CI step**: aceitável mas 30+MB download cada run. `npm install --no-save` cacheia no mesmo job (~5s).

**Custos aceitos:**

- Env defaults dummy em `dump-openapi.ts` precisam atualizar quando `env.validation.ts` adiciona novo required var. Mitigação: validação roda local no `types:api` + CI gate pega regressão no próximo PR.
- `CESTA_OPENAPI_DUMP=1` guard em `PrismaService` adiciona 2 linhas de dead code em prod. Aceitável — comentário explica + flag namespaced.

## Verification

- `scripts/generate-api-types.spec.mjs` — 18 unit tests (vitest): `parseArgs` + `normalizeTypes` + `computeDrift` exercitam equality normalization, CRLF/LF, trailing whitespace, line-add/modify detection, truncation @ 40 linhas.
- CI `types:api:check` step empírico — baseline inicial (160094 bytes, 157KB spec → ~160KB d.ts) matches fresh dump.
- Local verify: `npm run types:api` + `npm run types:api:check` passam sem Postgres/Redis rodando (env defaults cobrem).

## Follow-ups (post-S209)

- Opcional S21X: consumer migration — refactor `cesta-web/src/mocks` + `src/lib/api/*` pra importar types gerados (`import type { paths } from "@/types/generated/api.baseline"`) em vez de duplicar shapes manualmente. Fecha gap S201 completo.
- Se spec crescer > 1MB: trocar diff byte-level por diff de topology (paths + schemas) pra output legível. Atualmente 157KB — folga confortável.
