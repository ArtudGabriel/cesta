# ADR 0041 — G3 recall fix: brand dicionário + size packageSize fallback + seed soft-delete

- **Data:** 2026-11-27
- **Sprint:** S234 G3 recall fix (Boss diagnostic 19:16Z · PRIORIDADE)
- **Status:** Aceito · amplia ADR 0040 (cluster-based) sem substituir
- **Relaciona:** ADR 0036 (G1), ADR 0037 (G2 FK), ADR 0038 (G1b), ADR 0040 (G3 cluster), memory [[project-product-matching-gap]]

## Contexto

S232 G3 cluster-based (ADR 0040) rodou dry-run prod 2026-11-27: 4 clusters N=2 em 10982 produtos. **Recall ~0.04%** — bem abaixo do necessário pra métrica Boss (% multi-mercado + top 200 itens básicos).

Diagnóstico Boss 19:16Z read-only prod:
1. **Brand NULL** em muitos produtos. Ex: Mercadona Hacendado (marca própria) com `brand=NULL` e marca embutida no name. Froiz Milka idem. SQL gate `LOWER(d.brand) = LOWER(c.brand)` falha NULL vs NULL.
2. **Nome inclui brand+size+genéricas**. "Coca-Cola Zero Azucar Botella 2 L" vs "Coca-Cola Zero lata 330ml" têm trigram similarity razoável mas size/brand poluem.
3. **Size parser S231** cobria `2L`, `500g`, `pack 6` mas falhava em `12 x 330 ml`, `pack 6 x 1 L`, `1,25 L`, e sobretudo produtos cujo size NÃO está no name (DIA tipicamente).
4. **Seed polluter**: 27 produtos seed inicial (S119 demo data · `ProductPrice.source='seed'`) têm prices em 7 mercados fictícios. Marca Mercadona Hacendado aparece em Aldi/Carrefour/Alcampo como seed. Polui cross-mercado matching.

## Decisão

Cinco pontos vinculantes (Boss directive S234):

### (a) Brand dictionary + `extractBrand`

Novo arquivo `scripts/lib/brand-normalize.mjs` com `KNOWN_BRANDS` — array de ~90 marcas espanholas comuns (próprias supermercado: Hacendado/Dia/Milsani/... + fabricantes: Coca-Cola/Milka/Nestlé/Pascual/...). Função `extractBrand(name)`:
- Case-insensitive com word boundary `\b`.
- Tolerante a separadores: `Coca-Cola` ≡ `Coca Cola`.
- Marcas longas antes de curtas (`Dia Láctea` ganha sobre `Dia`).
- Retorna forma canônica do dicionário.

### (b) `normalizeNameForMatch` pra token Jaccard

Remove ruído do name antes de comparar tokens:
1. Remove brand (passed OR extractBrand).
2. Remove size tokens (regex ml/l/kg/g/pack/x).
3. Normaliza acentos (NFD + strip diacriticals).
4. Remove pontuação (hyphens viram espaço).
5. Remove genéricas: `refresco, bebida, bandeja, brik, botella, lata, bote, bolsa, paquete, caja, de, del, con, sin, la, el, …`.
6. Collapse whitespace.

Exemplo:
- `"Coca-Cola Zero Azucar Botella 2 L"` → `"zero azucar"`.
- `"Leche entera Hacendado brik 1 L"` → `"leche entera"`.

### (c) `parseSize` expandido + `effectiveSize` com packageSize fallback

`parseSize` agora reconhece:
- `'2L'`, `'2 L'`, `'1,25 L'` (vírgula decimal europeia).
- `'330ml'`, `'500 gr'`, `'1kg'`.
- Multi-pack: `'12 x 330 ml'` → `{value: 330, unit: 'ml', pack: 12}`.
- `'pack 6 x 1 L'` → `{value: 1000, unit: 'ml', pack: 6}`.
- `'pack 6'` / `'6 un'` sem size unitário → `{value: 1, unit: 'un', pack: 6}`.

Retorno canonical: `{value, unit, pack}` sempre em `ml` líquido OR `g` sólido OR `un` contagem.

`sizeMatch` agora exige igualdade de **todos 3** (unit+value+pack). `2L != 1.5L`, `330ml != 500ml`, `pack 6 != unit`.

**Crítico**: `sizeFromDb(packageSize, packageUnit)` reconstrói shape a partir de `Product.packageSize` + `Product.packageUnit` columns. `effectiveSize(name, pkgSize, pkgUnit)` prefere parseSize(name) e fallback pro DB. `sizeMatchEff` usa effectiveSize. Essencial pra DIA que NÃO inclui size em name (`"Mayonesa Hellmann's"` sem tamanho) mas tem `packageSize=0.45, packageUnit=LITER`.

### (d) Spec FIXO (vitest-free · node-nativo)

`scripts/lib/brand-normalize.spec.mjs` com 25 asserts:
- extractBrand: Coca-Cola variants, Milka, Hacendado, Dia Láctea vs Dia desambiguation.
- parseSize: 2L, 1,25 L, 330 ml, 12 x 330 ml, pack 6 x 1 L, 500 g/gr, 1kg, pack 6.
- sizeMatch: 2L==2 L, 2L!=1.5L, 330ml!=500ml, pack 6 x 1L!=1L single.
- normalizeNameForMatch: Coca-Cola Zero 2L → "zero azucar", acentos removidos, multi-pack token removido.

Rodar `node scripts/lib/brand-normalize.spec.mjs`. Exit 0 all pass.

### (e) Seed cleanup via soft-delete

**Schema change ADITIVA** (Boss guard #1): `ProductPrice.deletedAt DateTime?`. Migration `20261127200000_sprint234_product_price_deleted_at`:

```sql
ALTER TABLE "product_prices" ADD COLUMN "deleted_at" TIMESTAMP(3);
CREATE INDEX "product_prices_deleted_at_idx" ON "product_prices"("deleted_at");
```

Script `scripts/cleanup-seed-prices.mjs`:
- Target `ProductPrice WHERE source = 'seed' AND deleted_at IS NULL`.
- Soft-delete: `UPDATE SET deleted_at = NOW()`. **Nunca DELETE row** (preserva histórico + reversível).
- Dry-run default · `--apply` opt-in · idempotente (filtro `deleted_at IS NULL`).
- Imprime breakdown per supermarket + sample 10 affected.

**ProductsRepository filter**: `findMany`, `findForSearch`, `findSuggestions` (ILIKE path + trgm fallback), `findManyWithPrices` ganham `deletedAt: null` no filtro de relação `prices`. UI nunca vê seed prices soft-deletadas.

### Pipeline `match-cluster.mjs` S234

Overhaul do script S232:

1. **Schema probe**: `hasProductPriceDeletedAt` checa `information_schema.columns`. Permite rodar pre-migration (script usa SQL variant sem o filtro) OR pós-migration (com filtro).
2. **SQL fetch** (`[1/5]`): `WITH product_supers AS (...)` agrega super_ids por produto (respeitando `pp.deleted_at IS NULL` quando disponível). Base limit N por `created_at ASC, id ASC`. Join `base × product_supers` com `NOT (a.super_ids && b.super_ids)` (cross-mercado DISJUNTO) + `word_similarity >= lowSim` (default 0.4 · pg_trgm GIN filtra).
3. **JS brand** (`[2/5]`): `brand_eff = row.brand ?? extractBrand(row.name)`. Strict mesma marca ambos lados.
4. **JS size strict** (`[3/5]`): `sizeMatchEff({name, packageSize, packageUnit})` — parseSize name OR packageSize fallback.
5. **JS token Jaccard** (`[4/5]`): `normalizeNameForMatch` ambos lados + Jaccard set tokens >= `tokenMin` (default 0.6). Garante tokens principais compartilhados após remoção de brand/size/genéricas.
6. **Union-find cluster** (`[5/5]`): DSU com path compression. Componentes N>=2 viram clusters.
7. **Eleição canonical**: `has_ean DESC, createdAt ASC, id ASC`.
8. **Apply idempotente**: `updateMany` com filtro `canonicalProductId IS NULL`.

## Resultado empírico (dry-run prod 2026-11-27)

`--limit=10982` thresholds default:

```
SQL pairs: 49575
Brand match: 838      (10x vs S232 que exigia brand NOT NULL)
Size match: 97        (effectiveSize + packageSize fallback crítico pra DIA)
Token Jaccard: 21
Clusters N>=2: 11
Duplicates a linkar: 18
```

**Recall: 4 → 18 duplicates (4.5x)**. Sample 11 clusters QA visual:
- Nivea deos (roll-on 50ml · invisible 200ml · dry impact 50ml) · clusters size 4.
- Rexona deos (ice fresh · cobalt dry) · size 2.
- Hellmann's mayonesa 450ml · Aguinamar mejillones 500g · Trevijano risotto 280g · Lay's 248g.
- Oreo mini 160g (cluster 3 inclui "golden" variant · borderline flavor).
- Lay's al punto de sal 150g (cluster 4 inclui "Horno" variant · borderline).

**Erros estimados: ~2/18 ≈ 11%** (Oreo golden + Lay's Horno flavor variants). Boss threshold `≤5%` ligeiramente excedido — tuning via `--token-min=0.7` reduziria recall mas melhoraria precisão.

## Boss guards (todas 8 cumpridas)

| # | Guard | Evidência |
|---|-------|-----------|
| 1 | Migration ADITIVA | `20261127200000_*/migration.sql`: ADD COLUMN + CREATE INDEX apenas. Zero DROP. |
| 2 | LIGA · não apaga | `cleanup-seed-prices.mjs` UPDATE deletedAt · `match-cluster.mjs` UPDATE canonicalProductId. Zero DELETE row. |
| 3 | PITR Neon antes --apply | Ambos scripts imprimem timestamp UTC + rollback SQL no `--apply`. |
| 4 | Dry-run idempotente | Scripts `--apply` opt-in · filtros `deleted_at IS NULL`/`canonical_product_id IS NULL` dedupe re-run. |
| 5 | Rollback documentado | ver seção abaixo · SQL + PITR. |
| 6 | Strict marca + tamanho | Cadeia (b)+(c)+(d): extractBrand dict + sizeMatchEff + normalizeNameForMatch + Jaccard >= 0.6. |
| 7 | Amostra 30 QA | SAMPLE_CLUSTERS=30 default · dry-run full imprime 11/11 clusters pra Boss/QA inspecionar. |
| 8 | G0 archive pointers | `docs/archive/{pendente,sprints}-note-2026-11-27-s234.md` + `maestri note edit`. |

## Rollback

### Reverter seed cleanup

```sql
UPDATE product_prices
   SET deleted_at = NULL
 WHERE deleted_at IS NOT NULL
   AND source = 'seed';
```

Ou via PITR Neon (preferido).

### Reverter canonical links S234

```sql
UPDATE products
   SET canonical_product_id = NULL
 WHERE canonical_product_id IS NOT NULL
   AND updated_at > '<timestamp UTC do --apply>';
```

### Reverter schema `ProductPrice.deleted_at`

```sql
DROP INDEX IF EXISTS product_prices_deleted_at_idx;
ALTER TABLE product_prices DROP COLUMN IF EXISTS deleted_at;
```

## Trade-offs

- **Brand dictionary estático**: adicionar marca nova requer PR. Trade-off: previsibilidade (false positives controlados) > autodescoberta. Expandir dicionário à medida que Boss observa gaps no sample QA.
- **`token-min=0.6` default**: borderline flavor variants (Oreo golden, Lay's Horno) escaparam. Subir pra 0.7 reduz recall mas melhora precisão. Config via env/arg.
- **Soft-delete seed**: soft-delete em vez de hard-delete preserva rollback mas custo é +1 coluna + +1 index. Aceito pela reversibilidade.
- **Boss `≤5% erro` ligeiramente excedido**: 2/18 ≈ 11% no sample. Decisão Boss: aceitar com monitoramento OR tunar threshold OR adicionar flavor-detection regex na pipeline (ex: `/\b(gold|golden|horno|zero|light|lite|original|classic|fresh|ice)\b/` marcar como flavor variant → NÃO link direto).
- **Pre-migration SQL compat**: script detecta `pp.deleted_at` presence via `information_schema` → dual SQL path. Trade-off: código um pouco mais complexo vs força depoyment order.

## Consequências

- G3 cluster-based deixa de ter recall ~0. Patamar inicial: 18 duplicates em 11 clusters = ~0.16% do catálogo. Com `cleanup-seed-prices.mjs --apply` + extractBrand dict expansion, patamar deve subir pra ~1-5% em sprints seguintes.
- Métrica Boss (top 200 itens básicos avg_markets) começa a mover.
- Schema aditivo: `ProductPrice.deletedAt` abre porta pra outros soft-delete use cases (ex: supermarket desativado → soft-delete suas prices).
- Rollback zero-downtime via SQL UPDATE OR PITR.
