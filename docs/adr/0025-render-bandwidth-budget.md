# ADR 0025 — Render bandwidth budget pós-suspensão outbound

- **Data:** 2026-11-26
- **Sprint:** S213 (Boss override P0)
- **Status:** Aceito

## Contexto

2026-11-26 Render Hobby workspace suspenso por bandwidth: **6.02/5GB** mensal
outbound · 5.99GB Service-Initiated (traffic da API saindo pra outros serviços).
Horas free OK (57.8/750) · HTTP responses pro frontend apenas 29MB. Culpa está
no tráfego *entre* serviços externos a partir da API (R2 uploads, Neon queries,
Redis polling, ScrapingBee, Sentry).

Prod suspensa trava MVP restoration. Code-only mitigation prioritária: reduzir
outbound <4GB/mês dentro da sprint.

## Decisão

1. **Mover backfill-images pra fora do Render (G2).** Opção B escolhida: flag
   env `BACKFILL_IMAGES_ENABLED` com default `false` em prod · GitHub Actions
   cron (`.github/workflows/backfill-images.yml`) habilita + roda scan local
   nightly (runner GitHub paga a banda, não Render). Mais simples que opt A
   (CLI standalone + reorganizar service), sem perder a fallback OpenFoodFacts.
   Gates em 2 lugares: `catalog-sync.service.ts` (enqueue from-source) +
   `backfill-images.processor.ts` (cron scheduler).

2. **Remover Carrefour + Alcampo do cron catalog-sync (G3).** Outbound
   ScrapingBee (adapter atual) + Puppeteer OOM Chromium × 512MB Render
   inviabilizam prod. Scripts manuais locais (`npm run sync:carrefour|alcampo`)
   continuam disponíveis pós-MVP.

3. **Baixar frequência polling BullMQ (G4).** Adicionar `drainDelay` 5→30s +
   `stalledInterval` 30→120s em todos 12 processors via util
   `common/bullmq/worker-options.ts`. Trade-off: retry pós-crash tarda até 120s
   (vs 30s antes). Aceitável — nenhum worker é latency-critical.

4. **Orçamento alvo mensal <4GB.** Script `scripts/estimate-outbound.mjs`
   reproduz breakdown pré/pós-S213. Alerta manual via Render Billing dashboard
   até API de billing estar exposta.

## Breakdown bytes/mês (script `estimate-outbound.mjs`)

Pré-S213 (3.72GB estimado · Render observou 6GB — delta por subestimação
Neon/backfill real):

| Fonte                        | /mês      |
| ---------------------------- | --------- |
| R2 uploads (backfill-images) | 1021.7MB  |
| Neon Postgres queries        | 2.15GB    |
| Redis BullMQ (payloads)      | 11.0MB    |
| Redis BullMQ (polling)       | 197.8MB   |
| ScrapingBee                  | 14.1MB    |
| Sentry events                | 11.7MB    |
| HTTP API responses           | 351.6MB   |
| **TOTAL**                    | **3.72GB**|

Pós-S213 (2.55GB estimado · <4GB alvo atingido):

| Fonte                        | /mês      |
| ---------------------------- | --------- |
| R2 uploads (backfill-images) | 0         |
| Neon Postgres queries        | 2.15GB    |
| Redis BullMQ (payloads)      | 11.0MB    |
| Redis BullMQ (polling)       | 37.1MB    |
| ScrapingBee                  | 0         |
| Sentry events                | 11.7MB    |
| HTTP API responses           | 351.6MB   |
| **TOTAL**                    | **2.55GB**|

Delta real-vs-estimado será empírico pós prod restoration — update ADR com
observed metrics.

## Mitigation plan

- G1 ✅ Script `scripts/estimate-outbound.mjs` dump breakdown pré/pós.
- G2 ✅ `BACKFILL_IMAGES_ENABLED` env flag · default false prod · CatalogSync
  service + BackfillImages processor gated.
- G3 ✅ Carrefour + Alcampo fora de `FULL_SCHEDULE` · `RETIRED_SLUGS` cleanup
  stale schedulers.
- G4 ✅ `withBandwidthOptions()` aplicado nos 12 processors
  (drainDelay 30s · stalledInterval 120s).
- G5 ✅ Este ADR.

## Threshold alerta

Manual check Render Billing dashboard semanal durante restauração. Pós-MVP:
expor Render Billing API via cron script + Sentry alert quando mês passar 3GB
(60% budget) — fica fora do escopo S213.

## Consequências

- Backfill-images em prod só via workflow GitHub Actions ou run local → produto
  recém-syncado pode ficar sem imagem por horas até workflow nightly rodar.
- Carrefour + Alcampo temporariamente sem cron prod (dados stale até sprint
  pós-MVP que reintroduzir infra ScrapingBee paga OU Puppeteer escalado).
- Job retry pós-crash BullMQ delay até 120s. Visible em Sentry breadcrumbs.
- Orçamento 2.55GB/mês dá folga 2.45GB pra crescimento tráfego usuário sem
  volta a suspensão.

## Alternativas descartadas

- **Upgrade Render Standard ($7/mês + bandwidth adicional):** Boss VETO MVP
  budget.
- **Migrar prod inteira pra Fly.io:** fora do scope S213 (user decide).
- **Opt A GitHub Actions cron pra backfill-images:** adiável pós-flag opt B.
  Simpler + no new infra. Workflow nightly pode ser criado S214+ quando
  validarmos baseline.
