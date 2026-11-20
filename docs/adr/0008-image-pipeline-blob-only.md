# ADR-0008 — Pipeline de imagens Blob-only (Sprint 133)

**Status:** Accepted · **Data:** 2026-11-20

## Contexto

O MercadonaAdapter (S107→S118) persiste `raw.thumbnail` (ex.
`https://prod-mercadona.imgix.net/images/88451.jpg`) diretamente em
`Product.imageUrl`. Dois problemas:

1. **`next.config.ts` não permite `**.imgix.net`** nos `remotePatterns`. O
   loader de `<Image>` recusa o host e a imagem não renderiza em `/`,
   `/produto/[pid]`, `/comparar` e `/minha-lista`. O backfill script do S77
   (Vercel Blob via OpenFoodFacts) cobriu apenas os 27 seeds; os 7000+
   produtos ingeridos pelos adapters nunca passaram pelo Blob.
2. **Imgix é CDN de terceiro.** Links expiram, mudam de host (a Mercadona
   já quebrou `img*.mercadona.es` no passado), e dependem de uptime fora
   do nosso controle. A política existente para produtos sem EAN já era
   Blob (S77). Faltava unificar.

Sprint 117 escreveu o processador BullMQ `backfill-images` em branch, mas
o trabalho nunca foi mergeado para `main` — Eroski (S124) e Puppeteer
(S128→S130) andaram em paralelo e o branch ficou órfão.

## Decisão

**Única fonte de imagem em produção = Vercel Blob
(`**.public.blob.vercel-storage.com`).** Nenhuma URL de adapter é
persistida em `Product.imageUrl`.

### Pipeline

```
CatalogSync (Mercadona/Carrefour/…) upserta Product com imageUrl=null
         │
         ├─► raw.imageUrl presente?
         │     └─► enqueue backfill-images "from-source"
         │         jobId=img-{productId}, dedupe
         │
         └─► Cron 2h  "scan-and-backfill"
               │
               └─► varre Product.imageUrl=null,
                   resolve via OpenFoodFacts (EAN),
                   download + put() Vercel Blob,
                   update Product.imageUrl.
```

- **Service** `BackfillImagesService`
  - `backfillFromSource({ productId, sourceUrl })` — download `sourceUrl`
    (imgix, etc.) + `put('products/{id}.{ext}', bytes, { access:'public',
    cacheControlMaxAge: 1y, allowOverwrite: true, addRandomSuffix: false })`
    + `UPDATE product SET imageUrl=…`. Race-safe: re-lê Product antes do
    upload; se outro worker já preencheu com URL Blob, skip.
  - `scanAndBackfill(limit)` — cron fallback. Varre `imageUrl IS NULL`
    com limite (default 50/run), tenta OpenFoodFacts por EAN.

- **Queue** `backfill-images` (BullMQ, dedupe por `jobId`, removeOnComplete=200, removeOnFail=50)

- **Processor** `BackfillImagesProcessor`
  - `scan-and-backfill` (cron 0 */2 * * * em `Europe/Madrid`)
  - `from-source` (enqueued ad-hoc pelo `CatalogSyncService`)

- **Migração in-place**: cada sync Mercadona enfileira backfill para
  qualquer produto cujo `imageUrl` seja `null` **ou** aponte para
  domínio **não-Blob** (imgix, mercadona.es, etc.). Em 2-3 ciclos de sync
  o catálogo inteiro migra sem job separado de migração.

- **Política repo**: `createProductFromRaw` grava `imageUrl=null` sempre.
  `raw.imageUrl` nunca é fonte direta da coluna; vira apenas `sourceUrl`
  do job.

### Segurança

- `BLOB_READ_WRITE_TOKEN` já em prod Render (verificado via API S77/S117).
  Ausência → `AppException('BACKFILL_IMAGES.MISSING_BLOB_TOKEN', 424)` no
  service (fail-loud).
- UA rotation reutiliza `pickUserAgent()` (S117). OpenFoodFacts recebe
  UA identificado (`Cesta-App/0.1 (+contact: …)`).

## Consequências

**Ganhos:**
- Zero dependência de CDN externo em runtime do frontend.
- `remotePatterns` fica enxuto (só Blob + OpenFoodFacts).
- Imagens servidas com `cache-control: immutable, 1y` no Blob →
  performance consistente em cold-start Render.
- Backfill idempotente; re-queue não quebra.

**Custos:**
- Vercel Blob free tier ≈ 1 GB. 7000 produtos × ≈50 KB = 350 MB — folga.
- Primeira sync pós-deploy enfileira milhares de jobs. Concurrency do
  processor fica em 1 (default BullMQ) para não estourar ao Mercadona.
  Jitter 300-1200 ms entre downloads.
- Imagem fica stale se a Mercadona trocar o thumbnail. Mitigação S134+:
  TTL de 30 dias no `Product.imageUpdatedAt` (follow-up).

## Alternativas descartadas

- **Adicionar `**.imgix.net` ao `remotePatterns`.** Resolve o render mas
  mantém dependência de terceiro + 10 hostnames pra cada adapter futuro.
- **Proxy serverless `/_image?src=…`.** Cria hop extra. Vercel Image
  Optimization já faz isso com Blob; sem ganho.
- **One-shot migration script.** Prisma `updateMany` seria simples mas
  não cobre produtos criados *após* o script. Enqueue via sync é
  auto-reconciliante.

## Follow-ups

- S134: TTL/refresh de imagem (`imageUpdatedAt` + cron verifica staleness).
- S134: métrica `blob_backfill_pending` em `/admin/metrics`.
