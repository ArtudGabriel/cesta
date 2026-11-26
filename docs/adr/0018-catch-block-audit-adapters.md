# ADR 0018 — Catch-block audit: adapters + processors

- **Date:** 2026-11-26
- **Status:** Accepted (Sprint 193 — S71 nit close)
- **Related:** ADR 0013 (deploy resilience), S189 `withRetry` util, S190 deferred polite-fetch migration.

## Context

Grep audit em `cesta-api/src/modules/catalog-sync/` encontra **37 catch blocks** em 14 arquivos. Boss (S71 nit backlog) flagou possível "silent error swallowing" em paths HTTP:
- ECONNRESET / ECONNREFUSED / ETIMEDOUT podem ser suprimidos silenciosos → run completo não detecta transient outage CDN.
- Pattern "warn log + continue" em adapters pode mascarar regressão real (ex: CDN change bloqueia 100% requests mas adapter log mostra "skipped X items").

## Audit results

| Arquivo | #catch | Pattern | Verdict |
|---|---|---|---|
| `mercadona.adapter.ts` | 2 | warn + continue (cat-level), warn + return null (fetch-level) | OK — graceful degrade intencional |
| `dia.adapter.ts` | 2 | onRetry callback + fallback null | OK — delega a polite-fetch retry |
| `eroski.adapter.ts` | 4 | warn + skip item | OK — scraping HTML brittle |
| `froiz.adapter.ts` | 4 | warn + skip item | OK — scraping |
| `aldi.adapter.ts` | 1 | warn + skip | OK |
| `lidl.adapter.ts` | 2 | warn query + skip | OK (ADR 0016 regex parser) |
| `carrefour.adapter.ts` | 2 | warn + null (ScrapingBee ADR 0009) | OK |
| `alcampo.adapter.ts` | 3 | warn + null (Puppeteer S138) | OK |
| `puppeteer-fetch.ts` | 5 | screenshot save + warn | OK — debugging aid |
| `polite-fetch.ts` | 1 | retry loop classify | OK — delegates to `isRetryableStatus` + `maxRetries` |
| `catalog-sync.processor.ts` | 4 | warn + throw (schedule err non-fatal); process warn + throw (BullMQ marks failed) | OK — S191 observability wired |
| `catalog-sync.service.ts` | 2 | adapter-level log + partial result | OK |
| `backfill-images.service.ts` | 3 | per-product log + continue | OK |
| `backfill-images.processor.ts` | 2 | warn + throw (BullMQ) | OK |

## Findings

**Nenhum catch block "silent swallow".** Todos logam via `Logger.warn` ou `Logger.error`. Classifications:
- **Item-level skip** (scraping): intencional — um produto/categoria bad não aborta run de ~4000 items.
- **Adapter-level null return**: intencional — run marcado `partial` via `catalog-sync.service`, não `failed`.
- **Retry-level**: `polite-fetch` + `withRetry` S189 cobrem transient (ECONNRESET classified como network error → retry).

**Signal gap identificado** (não blocker):
- Sem counter de `total_items_skipped` por run exposto a `/admin/catalog-sync/runs`. Operator precisa grep log pra contar skip rate.
- Follow-up pós-MVP: adicionar campo `itemsSkipped` em `CatalogSyncRun` model.

## Decision

**NÃO integrar `withRetry` S189 em adapters nesta sprint.** Razões:
1. Polite-fetch retry (maxRetries + onRetry + Retry-After + minWaitOnBlock) é mais específico do que `withRetry` genérico. Já é testado (polite-fetch.spec 15+ casos).
2. S190 polite-fetch migration DEFERRED pós empirical restore — regressão prod obrigatória antes de refactor.
3. Catch blocks em adapters NÃO tocam retry — só logam + continuam. withRetry é para loops de execução, não error-recovery de item individual.

**Documentar pattern** inline (esta ADR) + manter graceful degrade atual.

## Follow-up pós-MVP

- Field `itemsSkipped` em `CatalogSyncRun` pra métricas skip rate (dashboard observability).
- Sentry breadcrumb helper S191 extension: `recordAdapterItemSkip({adapter, reason})` pra timeline em captureException.
- Avaliar migrate polite-fetch → withRetry S189 após prod-empirical S190 defer liberar.

## Consequences

- Zero mudança runtime nesta sprint — audit confirma pattern atual é intencional + safe.
- Catch block futuro deve seguir convention: log via Logger (não `console.*`) + nome da operação + error message. Silent `catch {}` continua proibido em review gate.
- Transient network errors (ECONNRESET/ECONNREFUSED/ETIMEDOUT) são classificados retryable no `polite-fetch` → sem mudança pra adapters.
