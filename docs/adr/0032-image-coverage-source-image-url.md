# ADR 0032 — Product.sourceImageUrl pra scan-and-backfill sem EAN

- **Data:** 2026-11-27
- **Sprint:** S224 (MVP Bloco 2 fotos)
- **Status:** Aceito
- **Estende:** ADR 0008 (pipeline blob-only)
- **Pré-requisito:** ADR 0026 (GHA cron backfill-images)

## Contexto

Audit S224 revelou cobertura fotos por supermercado:

| slug      | total | com_imagem | %     |
| --------- | ----- | ---------- | ----- |
| mercadona | 4074  | 4046       | 99.3% |
| dia       | 3043  | 3002       | 98.7% |
| lidl      | 1227  | 1003       | 81.7% |
| aldi      | 375   | 336        | 89.6% |
| eroski    | 746   | 0          | 0.0%  |
| froiz     | 366   | 0          | 0.0%  |

Eroski + Froiz adapters (S220 + S221) ingeriram 1112 produtos **sem nenhuma
imagem** em Product.imageUrl. Investigação:

1. Adapters produzem `raw.imageUrl` corretamente (verificado por grep
   adapters/*.ts).
2. ADR 0008 (S133) força `createProductFromRaw` a persistir
   `Product.imageUrl = null`; o raw.imageUrl vira apenas sourceUrl de um job
   `backfill-images from-source` na BullMQ queue.
3. ADR 0025 (S213) suspendeu `BACKFILL_IMAGES_ENABLED` em prod Render pra
   economizar bandwidth → o enqueue `from-source` é skipped silenciosamente.
4. ADR 0026 (S216) moveu cron pra GHA mas usa `scanAndBackfill(limit)` que
   só resolve imagem via **OpenFoodFacts por EAN**.
5. Audit `scripts/audit-ean-coverage.mjs`: **100% dos 1618 produtos missing
   image têm `ean=NULL`**. OFF é inútil pra todos.

Resultado: o único path de upload R2 (enqueue `from-source`) depende do
flag Render que está off; o path backup (scan OFF) tem 0% hit rate pro
backlog atual. Fotos novas crescem apenas via BackfillImagesService quando
`BACKFILL_IMAGES_ENABLED=true` — nunca aconteceu desde S213.

## Decisão

1. **Nova coluna `Product.sourceImageUrl`** (nullable, mapeada `source_image_url`).
   Guarda a URL de origem fornecida pelo adapter. Preserva invariante ADR 0008:
   `Product.imageUrl` segue populado só com URLs de storage gerenciado (R2).

2. **`CatalogSyncRepository.createProductFromRaw`** persiste `raw.imageUrl`
   em `sourceImageUrl` (produtos novos cobertos da criação).

3. **`CatalogSyncRepository.updateSourceImageUrl(productId, url)`** novo.
   `CatalogSyncService` chama em cada iteração quando `raw.imageUrl !==
   product.sourceImageUrl` (produtos legacy cobertos no próximo ciclo
   catalog-sync).

4. **`BackfillImagesService.scanAndBackfill`** prioriza `sourceImageUrl`:
   ```
   sourceUrl =
     product.sourceImageUrl                          (path S224)
     ?? (product.ean ? resolveOpenFoodFacts(ean) : null)  (path S133 fallback)
   ```
   Elimina depenência de EAN quando adapter trouxe URL.

5. **`BackfillImagesRepository.findCandidates`** ordena por
   `sourceImageUrl DESC NULLS LAST` + `createdAt ASC` — prioriza produtos
   com pista garantida (Eroski + Froiz já cobertos a partir do próximo
   ciclo catalog-sync).

## Trade-offs aceitos

- **Latência de 1 ciclo catalog-sync pra legacy.** Produtos existentes
  (1618) populam sourceImageUrl só no próximo sync nightly (cron
  bd22cd, 03-06 UTC Europe/Madrid). GHA backfill-images (03 UTC) então
  drena até `--limit=100` por noite. Backlog ~1618 / 100 = ~17 noites pra
  cobertura total, assumindo 0 falha download.
- **`updateSourceImageUrl` 1 write por produto por re-sync.** Dedupe via
  `product.sourceImageUrl !== raw.imageUrl` — no-op quando igual, evita
  write amplification.
- **Crescimento modesto do row.** Coluna TEXT nullable, ~100-200 bytes
  médios. 10k produtos = ~1-2 MB extra Neon storage. Dentro do Launch $5
  (fica confortável <1% do orçamento).

## Alternativas descartadas

- **Persistir raw.imageUrl direto em Product.imageUrl** (reverte ADR 0008).
  Descartado: expõe CDN supplier ao frontend (`next.config.ts`
  remotePatterns não inclui eroski.es, froiz.com, etc.); quebra renderização
  `<Image>`; CDNs externos podem bloquear cross-origin e sumir sem aviso.
- **One-shot migration script que re-roda cada adapter pra popular
  sourceImageUrl offline.** Seis adapters × ~1700 produtos cada =
  possível mas joga GHA runner budget fora. O catalog-sync cron já
  re-roda nightly por outro motivo (price refresh) — piggyback é grátis.
- **Reativar BullMQ `from-source` enqueue (flip BACKFILL_IMAGES_ENABLED).**
  Volta a consumir bandwidth outbound Render (R2 PUTs) que ADR 0025
  explicitamente tirou pra economia. Mantém os dois caminhos independentes.

## Rollback

Se migração causar issue:
1. `ALTER TABLE products DROP COLUMN source_image_url` (manual rollback).
2. Reverter commits S224 — `createProductFromRaw` volta ao estado S133.
3. `scanAndBackfill` volta a usar só OFF via EAN (backlog fica em 0% pros
   1618 missing, mas comportamento pre-S224).

## Métricas de sucesso

- Audit pós-S224 (próximo ciclo catalog-sync + 1 run GHA):
  `node scripts/audit-image-coverage.mjs` reporta >= **95%** nos 6 supers
  MVP ativos (Mercadona, DIA, LIDL, Aldi, Eroski, Froiz).
- Logs GHA `scanAndBackfill done: uploaded=N fallback=M`: `uploaded` cresce
  a cada noite enquanto backlog não zera (hoje `uploaded=0 fallback=20`).
- `scripts/audit-ean-coverage.mjs` mostra queda de `missing` por supermarket
  noite após noite.
