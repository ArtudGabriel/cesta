# ADR 0038 — Matching cross-mercado G1b: audit EAN nos 5 adapters remanescentes

- **Data:** 2026-11-27
- **Sprint:** S229 G1b (P0-CORE matching cross-mercado, chain pós S228 G1+G2)
- **Status:** Aceito (audit + backfill opt-in · G3 cobre gaps)
- **Relaciona:** ADR 0036 (G1 Aldi JSON-LD gtin), ADR 0037 (G2 canonical merge), memory [[project-product-matching-gap]]

## Contexto

S228 G1 populou `Product.ean` para o Aldi via JSON-LD. G2 adicionou `canonicalProductId` + reconciliação runtime por EAN. Mas Boss sinalizou (2026-11-27): "G2 merge precisa ≥2 mercados com EAN → hoje linka ~0".

G1b audita os 5 adapters remanescentes pra identificar onde a fonte expõe EAN. Decisão informa G3 (pg_trgm trigram para o que ficar sem EAN).

## Metodologia

Script `scripts/audit-adapter-ean-sources.mjs` faz probe live **read-only** dos endpoints públicos (zero write, zero credencial). Caça campos `ean|gtin|barcode|upc` recursivamente e reporta per adapter:
- `list_ean_fields`, `detail_ean_fields` (shape)
- Decisão: `ADD`, `KEEP`, `GAP → G3`

**Limitação do probe desta sessão**: endpoints DIA/LIDL/Eroski retornam `HTTP 403` ou anti-bot ao serem fetchados de IP residencial fora da Espanha. Mercadona + Froiz responderam. Audit complementa com leitura estática de adapter + spec fixtures.

## Findings per adapter

### 1. Mercadona (API JSON)

- **Endpoint list** `/api/categories/<id>/?wh=mad1`: **993 produtos sampleados · 0 com `ean`** no payload. **Mercadona removeu o campo `ean` da listagem de categoria.** Spec fixture histórica em `mercadona.adapter.spec.ts` ainda carrega `ean: '8480000181732'` — referencia API anterior.
- **Endpoint detail** `/api/products/<id>/?wh=mad1`: **retorna `ean`** (confirmado: product `4241` → `"ean": "8402001027482"`).
- **Adapter runtime** olha pra `raw.ean` no list → produtos novos entram com `ean: null`.

**Decisão:** não alterar runtime (manter cron barato). Introduzir backfill opt-in `scripts/mercadona-backfill-ean.mjs` dry-run/apply que fetcha `/api/products/<id>/` apenas para Products com ean=NULL. Mercadona ID é extraído do `imageUrl` (`prod-mercadona.imgix.net/images/<id>.jpg`).

### 2. DIA (API JSON `search-back/search`)

- **Probe bloqueado** (HTTP 403 fora de Espanha).
- **Audit estático** adapter: shape documenta `object_id`, `sku_id`, `display_name`, `brand`, `image`, `prices`, `l1/l2_category_description`, `url`, `units_in_stock`.
- **Nenhum campo EAN/GTIN exposto**. `sku_id` é código DIA interno (ex: `504P6` mix alfanumérico → não é EAN-13 numérico).

**Decisão:** **GAP → G3**. Page detail (`/compra-online/*/p/<id>`) pode ter JSON-LD mas requer per-product polite-fetch (2945 produtos × 2-5s = 2-4h por sync). Fora de escopo runtime.

### 3. LIDL (`/q/search` JSON embed)

- **Probe bloqueado** (sem JSON embed detectado no HTML retornado — possível anti-bot ou mudança estrutural).
- **Audit estático** adapter + fixture: shape `{ erpNumber, fullTitle, image, keyfacts.analyticsCategory, price, brand?, productType? }`.
- **`erpNumber` é LIDL interno** (ex: `100408539002`, `11001765`). Comprimentos variáveis (8–12 dígitos), format LIDL — NÃO é EAN-13.
- **Nenhum campo EAN exposto** no search response.

**Decisão:** **GAP → G3**. Pages de produto (`/productId/<erpNumber>`) poderiam ter JSON-LD mas requer per-product fetch (custo similar DIA).

### 4. Eroski (HTML `data-metrics` attribute)

- **Probe bloqueado** (sitemap retornou `sem data-metrics` na categoria sampleada; possível rate-limit datacenter IP, memory confirma anti-bot CDN Eroski).
- **Audit estático** adapter + fixture: `DataMetricsItem` carrega `price, item_name, item_id, item_brand, item_category*, item_variant, index, quantity`.
- **`item_id`** é Eroski interno numérico (`23760622`) — não é EAN.

**Decisão:** **GAP → G3**. Product detail pages poderiam ter JSON-LD mas depende de polite-fetch per-product idêntico DIA/LIDL.

### 5. Froiz (HTML bare scrape)

- **Probe OK**: HTML da categoria `alimentacion/galletas` sem `<script type="application/ld+json">` **nem** `data-ean|ean-\d+` attr detectável.
- **Audit estático** adapter: `.product-grid .product` cards só expõem `name`, `price`, `image` e um offer badge. Sem IDs estáveis sequer (adapter deriva ID do nome via slug).

**Decisão:** **GAP → G3**. Froiz é o adapter mais pobre em metadados; depende 100% de G3 trigram.

## Resumo decisão

| Adapter | Fonte EAN exposta? | Ação S229 |
|---------|-------------------|-----------|
| mercadona | ❌ list · ✅ detail opt-in | `mercadona-backfill-ean.mjs` dry-run/apply · runtime inalterado |
| dia | ❌ (probe 403; audit estático) | **GAP → G3 trigram** |
| lidl | ❌ (probe falhou; audit estático) | **GAP → G3 trigram** |
| eroski | ❌ (probe falhou; audit estático) | **GAP → G3 trigram** |
| froiz | ❌ (probe OK; sem structured data) | **GAP → G3 trigram** |

## Boss guards (herdados S228 G2)

| # | Guard | Evidência |
|---|-------|-----------|
| 1 | Migration ADITIVA | **N/A** — G1b não altera schema (G2 schema já suficiente) |
| 2 | LIGA, não apaga | `mercadona-backfill-ean.mjs` só faz `UPDATE products SET ean = ?`; nunca `DELETE` |
| 3 | Snapshot Neon antes de --apply em prod | script imprime reminder no `--apply` |
| 4 | Dry-run idempotente | `--apply` opt-in · filtro `ean IS NULL` dedupe · `--limit N` controla rate |
| 5 | Rollback documentado | ver seção abaixo |

## Rollback

Script é `UPDATE products SET ean = <valor>`. Rollback conservador:

```sql
-- Identificar rows alteradas via timestamp (updated_at após o run).
-- Backfill não tem flag de origem no schema, então rollback via Neon
-- restore (ponto-no-tempo antes do run) é a opção mais segura.
--
-- Rollback SQL apenas para o subset Mercadona:
UPDATE products
   SET ean = NULL
 WHERE id IN (
   SELECT DISTINCT p.id
   FROM products p
   JOIN product_prices pp ON pp.product_id = p.id
   JOIN supermarkets s ON s.id = pp.supermarket_id
   WHERE s.slug = 'mercadona'
     AND p.ean IS NOT NULL
     AND p.updated_at > '<timestamp do --apply>'
 );
```

Para rollback zero-erro, usar PITR Neon (restore point ou branch) como fonte de verdade.

## Trade-offs

- **Backfill opt-in em vez de runtime**: cron Mercadona permanece ~1h (não fica 2-4h). Admin roda `--apply --limit 200` quando quiser empurrar enriquecimento. Progressive: limit 200/run × 20 runs = 4000 produtos cobertos.
- **4 adapters sem EAN dependem 100% de G3**: pg_trgm `brand + normalized_name + size_unit` será a ponte. G3 já é escopo próximo (`feat/s229-g3-trigram-match-no-ean` em paralelo).
- **Probe bloqueado em DIA/LIDL/Eroski**: audit estático supre, mas **recomendação**: rodar `scripts/audit-adapter-ean-sources.mjs` desde Render prod (IP ES) ou proxy BR→ES pra confirmar findings. Tracking como follow-up P3 S230.
- **Mercadona ID extraído de `imageUrl`** (pré-S230): dependência frágil. **Observado em prod S230 (Boss finding 2026-11-27 18:40Z)**: dry-run `--limit 30` retornou 27/30 "no mercadona id" porque `imageUrl` migrou pra R2 pós-S213+S216 (`cesta-products.<account>.r2.dev/mercadona/<slug>.jpg`) — regex Mercadona imgix não bate. **Fix S230** no script: lê **apenas** `sourceImageUrl` (URL original persistida pós-S224 ADR 0032). Produtos pré-S224 têm `sourceImageUrl = NULL` e são skippados com contador `noSourceUrl` separado (aguardam próximo cron S224 populate). Alternativa robusta `Product.externalId`/`mercadonaId` field permanece P3 follow-up se cobertura não crescer.

## Consequências

- `scripts/mercadona-backfill-ean.mjs` disponível como ferramenta dev/ops.
- ADR 0038 documenta decisão explícita per adapter → G3 sabe exatamente onde apostar.
- G2 `linkSupermarketDuplicate` continua silencioso até G3 popular `normalizedName` cross-mercado.
- Nenhuma mudança nos cron atuais.

## Updates

### 2026-11-27 (S230 fix · Boss finding 18:40Z)

- Backfill script S229 G1b quebrou no dry-run `--limit 30` em worktree: 27/30 `no mercadona id · sem image_url padrão` · 3/30 `http fail` · 0 ean found.
- Root cause: `imageUrl` migrou pra R2 (S213+S216); script caía em `imageUrl` quando `sourceImageUrl` NULL.
- Fix PR `fix/s230-mercadona-backfill-id-source`:
  1. Script lê **apenas** `sourceImageUrl` (não cai em `imageUrl`).
  2. Novos contadores separados: `noSourceUrl` (legacy pré-S224) × `noIdInUrl` (URL presente mas regex não bate).
  3. HTTP failures logam `status`, `retry-after`, `cf-ray`, `x-request-id` (sample 10 primeiras) pra Boss diagnosticar rate-limit/UA ban Mercadona.
  4. Rollback atualizado: coluna `source` **nunca existiu** no schema; reforço de PITR Neon preferido + SQL por `updated_at > <timestamp UTC>` secundário (script imprime timestamp `date -u` no `--apply`).
- Procedimento validação Boss: rerun dry-run `--limit 30` pós-fix → `ean_found > 0` se `sourceImageUrl` cobre amostra; senão escalar `noSourceUrl` count (aguarda cron S224 populate).
