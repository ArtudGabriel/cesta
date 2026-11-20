# ADR-0010 — Storage migration Vercel Blob → Cloudflare R2 (Sprint 135)

**Status:** Accepted · **Data:** 2026-11-20

## Contexto

ADR 0008 adotou Vercel Blob free tier como storage único das imagens
de produto. Em 2026-11-20 o quota de **2 000 writes/mês** esgotou — a
migração imgix → Blob (S133) + backfills incrementais consumiram todo
o orçamento antes do mês fechar. Produtos Mercadona atualizados a partir
daí não conseguem mais subir imagens; `Product.imageUrl` fica `null`.

Reads do Blob continuam funcionando durante a pausa do write, portanto
a migração tem janela segura para copiar bytes.

## Decisão

Trocar provider por **Cloudflare R2** (bucket `cesta-products`, região
EU, já provisionado via Cloudflare dashboard):

- **10 GB storage** (vs 1 GB Blob free; 7 134 produtos × 50 KB ≈ 350 MB
  → sobra 96 %).
- **10 M writes/mês** (vs 2 k Blob free — 5 000× mais).
- **Zero egress** (Blob cobra US$ 0.15 / GB; R2 grátis).
- **S3-compatible** (`@aws-sdk/client-s3`) — sem lock-in.

Mantém o shape `products/{productId}.{ext}` da chave; URLs públicas ficam
`https://pub-<token>.r2.dev/products/{id}.{ext}`.

### Abstração

Novo módulo `cesta-api/src/modules/storage/`:

- `storage.service.interface.ts` — `StorageService` com `uploadImage`,
  `getPublicUrl`, `isManagedUrl`. Injection token `STORAGE_SERVICE`.
- `r2-storage.service.ts` — `S3Client` apontando pra `R2_S3_ENDPOINT`
  (ou derivado de `R2_ACCOUNT_ID`), `PutObjectCommand` com
  `CacheControl: 'public, max-age=31536000, immutable'`.
- `storage.module.ts` — `@Global` para que qualquer feature injete sem
  importar o módulo diretamente.

### Consumers refatorados

- `backfill-images.service.ts` (S117/S133) — injeta
  `@Inject(STORAGE_SERVICE)`, remove `put` do `@vercel/blob`, substitui
  `isBlobUrl` por `storage.isManagedUrl`.
- `catalog-sync.service.ts` — substitui `isBlobUrl(product.imageUrl)`
  por `storage.isManagedUrl(product.imageUrl)` no gate de enqueue.
- Script S77 `scripts/backfill-product-images.ts` **removido**
  (BullMQ cron `scan-and-backfill` já faz o trabalho; script era
  one-shot pré-S117).

### Migração

Script one-shot `scripts/migrate-blob-to-r2.ts`:

1. `SELECT WHERE imageUrl LIKE '%.public.blob.vercel-storage.com%'`
   até `--limit` (default 1 000).
2. Para cada produto: download via `fetch(blobUrl)`, `PutObjectCommand`
   para R2, `UPDATE Product.imageUrl` apontando `pub-.../r2.dev/...`.
3. Idempotente: pula produtos cuja `imageUrl` já contém o host R2.
4. `--dry-run` imprime o mapeamento sem escrever.

Run previsto: 2-3 batches de 1 000 na Render shell até migrar ≥ 90 %
(G1 do DoD S135).

### Env vars (Render)

- `R2_ACCOUNT_ID` — ID da conta Cloudflare.
- `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` — credenciais S3-API.
- `R2_BUCKET` — `cesta-products`.
- `R2_S3_ENDPOINT` (opcional) — override se usar jurisdiction EU
  (ex. `https://<account>.eu.r2.cloudflarestorage.com`).
- `R2_PUBLIC_BASE_URL` — URL pública do bucket (`https://pub-....r2.dev`).

Env `BLOB_READ_WRITE_TOKEN` fica no Render **durante** a migração
(script precisa dele para `fetch(blobUrl)` ler). **Post-migration:** user
remove a var + dependência `@vercel/blob` do `package.json` em sprint
de limpeza (S136).

### Frontend

`cesta-web/next.config.ts` adiciona `**.r2.dev` em `remotePatterns`;
`**.public.blob.vercel-storage.com` continua durante o bootstrap para
não quebrar produtos ainda não migrados. Limpeza do Blob entra na S136.

## Consequências

**Ganhos:**
- Quota 10 M writes resolve volume indefinidamente (atual: 20 syncs ×
  100 novos/dia = 2 k/dia × 30 = 60 k/mês, 0.6 % da R2 free tier).
- Zero egress → serves múltiplos sem custo marginal.
- Abstração `StorageService` facilita swap futuro (minio, S3, etc.).

**Custos:**
- Primeiro deploy pós-migração precisa de 6 env vars em Render
  (Manager provisiona via Render API).
- Script migration bate Vercel Blob reads em sequência — observar
  rate-limit; sleep 150 ms entre uploads para folga.
- `@vercel/blob` fica temporariamente nas deps até S136 cleanup.

## Alternativas descartadas

- **AWS S3** — egress pago (US$ 0.09/GB), billing por estoque + request;
  mais caro a longo prazo pra zero egress use-case.
- **Backblaze B2** — free tier (10 GB) comparável mas egress pago
  US$ 0.01/GB + menor integração CDN.
- **Upgrade Vercel Blob Pro** — US$ 20/mo para 10 k writes/mês ainda
  cobre 50× menos que R2 free; pior relação.

## Follow-ups S136

- Deletar `BLOB_READ_WRITE_TOKEN` do Render.
- Remover `@vercel/blob` dep do `cesta-api/package.json`.
- Remover `**.public.blob.vercel-storage.com` do `next.config.ts
  remotePatterns`.
- Métrica em `/admin/metrics`: `storage_bytes_used` + `r2_requests_mtd`
  via Cloudflare API.
