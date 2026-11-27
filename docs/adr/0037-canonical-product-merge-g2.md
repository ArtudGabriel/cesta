# ADR 0037 — Matching cross-mercado G2: produto canônico via `canonicalProductId`

- **Data:** 2026-11-27
- **Sprint:** S228 G2 (P0-CORE matching produto entre mercados)
- **Status:** Aceito (migração aditiva · runtime cleanup via catalog-sync · script histórico dry-run+apply)
- **Relaciona:** ADR 0036 (G1 EAN audit + Aldi JSON-LD), memory [[project-product-matching-gap]]

## Contexto

S228 G1 populou `Product.ean` para o Aldi (via JSON-LD `gtin13/gtin12/gtin/gtin8`), somando-se a Mercadona/Alcampo/Carrefour. Mas o DB ainda tem **duplicatas históricas** criadas pelos adapters quando o EAN estava ausente: cada run antes do G1 chamava `createProductFromRaw` com `ean: null`, gerando um Product novo por supermarket para o mesmo item.

Exemplo real (prod 2026-11-27):
- Mercadona syncou "Coca-Cola Zero Azucar 2L" com `ean=8410128000023` → Product P1 criado (canonical).
- Aldi (pré-G1) syncou o mesmo item com `ean=null` → Product P2 criado + ProductPrice(P2, aldi).
- Resultado: dois Products diferentes pro mesmo item, usuário não compara.

Com G1 populando o Aldi.ean, o **próximo** sync vai hitar `findProductByEan` → retorna P1. Mas P2 continua no DB como "fantasma" com o preço antigo do Aldi.

## Decisão

### Schema (migração aditiva)

Adicionar coluna opcional `Product.canonicalProductId` self-FK:

```prisma
model Product {
  // ...
  canonicalProductId String? @map("canonical_product_id")

  canonical  Product?  @relation("ProductCanonical", fields: [canonicalProductId], references: [id])
  duplicates Product[] @relation("ProductCanonical")

  @@index([canonicalProductId])
}
```

Migration SQL em `prisma/migrations/20261127180000_sprint228_canonical_product_id/migration.sql` — `ADD COLUMN` + `ADD CONSTRAINT FOREIGN KEY` + `CREATE INDEX`. **Zero DROP/DELETE** (Boss guard #1 aditiva).

### Runtime cleanup (catalog-sync)

`catalog-sync.service.matchProduct` passa a retornar `{ product, viaEan }`. Quando `viaEan === true` (match veio por EAN exato), o service chama o novo `linkSupermarketDuplicate({ canonicalId, normalizedName })` **antes** do `upsertPrice`:

```ts
if (matched.viaEan) {
  const { linked } = await this.repo.linkSupermarketDuplicate({
    canonicalId: product.id,
    normalizedName: normalizedForRaw,
  });
  if (linked) stats.itemsMergedCanonical += 1;
}
```

`linkSupermarketDuplicate` procura um Product com `normalizedName` igual, `ean IS NULL`, `canonicalProductId IS NULL`, e seta `canonicalProductId = canonicalId`. **Não deleta ProductPrice, nem Product** (Boss guard #2 LIGAR, não apagar — preserva FKs de favorites/lists/alerts/reviews/snapshots).

Novo contador `SyncResult.itemsMergedCanonical` aparece em `/admin/catalog-sync/runs`.

### Script histórico `scripts/merge-canonicals.mjs`

Catalog-sync faz o link em runtime quando adapter traz EAN; o script faz a **passagem histórica** única pra DB atual. Modo default `--dry-run`:

```
node scripts/merge-canonicals.mjs             # dry-run: imprime N, M, K
node scripts/merge-canonicals.mjs --apply     # grava
```

Dry-run imprime:
- Candidatos encontrados (join self via `normalized_name`).
- Canonicals impactados.
- Preview das 10 primeiras duplas (sanity check visual).

Apply em lotes de 500 com `product.updateMany` + filtro idempotente (`canonical_product_id IS NULL`). Re-run = zero mudança (Boss guard #5).

### Audit script `scripts/audit-canonical-merge.mjs`

Read-only. Mede:

1. Overview: total, canonicals, duplicates, canonicals_with_ean.
2. Multi-market canonicals (métrica G4): canonicals com `COUNT(DISTINCT supermarket_id) >= 2`.
3. Linked duplicates per supermarket.

Rodar **antes e depois** do `merge-canonicals.mjs` pra confirmar efeito.

## Boss guards (vinculantes)

| # | Guard | Evidência |
|---|-------|-----------|
| 1 | Migration ADITIVA · zero DROP/DELETE | `migration.sql`: `ADD COLUMN` + `ADD CONSTRAINT` + `CREATE INDEX` apenas |
| 2 | Merge = LIGAR, não apagar | `linkSupermarketDuplicate` só faz `UPDATE products SET canonical_product_id = ?`; preserva FKs |
| 3 | Snapshot Neon antes de prod | script imprime reminder no `--apply`; PR body registra snapshot ID |
| 4 | Script merge idempotente + dry-run | `--apply` opt-in · dry-run default · filtro `canonicalProductId IS NULL` dedupe |
| 5 | Rollback documentado | ver seção abaixo |

## Rollback

Caso o merge cause regressão de busca/UI, rollback trivial via SQL raw:

```sql
UPDATE products
  SET canonical_product_id = NULL
WHERE canonical_product_id IS NOT NULL;
```

Rollback completo (reverter schema):

```sql
DROP INDEX IF EXISTS products_canonical_product_id_idx;
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_canonical_product_id_fkey;
ALTER TABLE products
  DROP COLUMN IF EXISTS canonical_product_id;
```

A FK foi declarada com `ON DELETE SET NULL` — se um canonical for soft-deletado (`deletedAt`), as duplicatas ficam com `canonicalProductId` dangling (apontando pra row com `deletedAt != null`). Isso é aceitável porque o filtro de UI (`canonicalProductId IS NULL AND deletedAt IS NULL`) ignora ambos, e a query do audit cobre o caso.

## Trade-offs

- **Duplicatas ficam no DB.** Consulta de produto por ID (favorites/lists/alerts) ainda resolve. UI de listagem filtra `canonicalProductId IS NULL` em G4 (sprint seguinte · ProductsRepository findMany/findSuggestions/findForSearch). Pequeno custo de leitura (coluna indexada).
- **Matching depende de `normalizedName` exato.** Se `slugifyName(brand + name)` diverge entre adapters (acentuação, abreviação), o `linkSupermarketDuplicate` não acha o duplicate. G3 (pg_trgm) cobre esses casos com threshold de confiança.
- **Script histórico roda 1x por apply.** Cron de sync adapta adiante. Re-run idempotente mas O(canonicals × duplicates/canonical) — monitorar se dataset crescer muito.
- **Não há métrica de confiança no link runtime.** `normalized_name` match exato é alto-confiança por construção (slugify padrão), mas edge cases de homônimos (ex: "Água Mineral 1L" de duas marcas) poderiam colidir. Mitigação: filtro `ean IS NULL` no duplicate garante que só non-canonical é tocado.

## Consequências

- `SyncResult.itemsMergedCanonical` aparece em admin runs — observabilidade nova.
- Próximo cron Aldi pós-G1 vai gerar os primeiros links (empírico esperado D+1).
- Audit script (`node scripts/audit-canonical-merge.mjs`) vira ferramenta padrão de check pré/pós deploy.
- G3 (trigram marca+nome+unidade) + G4 (métrica prod + UI filtro `canonicalProductId IS NULL`) em sprints separadas.
- Rollback zero-downtime via UPDATE.
