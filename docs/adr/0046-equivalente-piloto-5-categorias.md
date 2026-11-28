# ADR 0046 — "Produto equivalente" piloto 5 categorias

- **Data:** 2026-11-28
- **Sprint:** S245 P0-CORE "equivalente" piloto (ADR 0042 ACCEPTED · user direção A autorizou)
- **Status:** Aceito (migration aditiva · read path brand-neutral · script match-equivalent.mjs · dry-run default)
- **Relaciona:** ADR 0042 (S235 proposta), ADR 0040 (S232 G3 cluster), ADR 0044 (S244 read path canonical)

## Contexto

S244 (ADR 0044) entregou o read path "mismo producto" (`canonicalProductId`): Hellmann's 450ml em Mercadona + Carrefour viram UM card com badge verde. Boss `match-cluster --apply` executado 2026-11-28 00:31:28Z UTC populou 14 clusters (14 duplicates linkados · 0/14 erro).

Mas o PROBLEMA REAL do usuário continua: Mercadona domina com Hacendado (marca própria), Dia tem Dia Láctea / Milsani, cada supermercado tem sua marca própria. "Mismo producto" NÃO une marcas diferentes. Resultado: usuário no app vê Mercadona isolado da comparação.

ADR 0042 propôs 3 caminhos; user autorizou direção A (I): implementar `ProductEquivalente` + UI separada. Boss autorizou S245 como **PILOTO** em 5 categorias (não full catalog) pra medir impacto antes de expandir:
- leche (entera, semi, desnatada)
- agua mineral
- huevos
- aceite oliva (virgen extra + regular)
- pan de molde

Essas 5 categorias cobrem compras recorrentes high-frequency onde comparação cross-brand faz mais diferença pro usuário final.

## Decisão

### Schema (migration ADITIVA)

Adiciona coluna `Product.equivalentGroupId String?` nullable + índice:

```prisma
model Product {
  // ...
  equivalentGroupId String? @map("equivalent_group_id")
  @@index([equivalentGroupId])
}
```

Migration SQL (`20261128000000_sprint245_equivalent_group_id/migration.sql`):
```sql
ALTER TABLE "products" ADD COLUMN "equivalent_group_id" TEXT;
CREATE INDEX "products_equivalent_group_id_idx" ON "products"("equivalent_group_id");
```

Zero DROP/DELETE (Boss guard #1). Column nullable → zero backfill required pra deploy.

### Algoritmo equivalência (`scripts/match-equivalent.mjs`)

1. **Fetch**: `SELECT` produtos ativos (prices.some isAvailable deletedAt null) com `canonical_product_id IS NULL` (apenas canonicals; S244 já dedupou "mismo").
2. **Classify**: `classifyTypeKey(name, brand)` via regex lookup tabela `TYPE_PATTERNS` em `scripts/lib/equivalent-types.mjs`. Null = fora piloto.
3. **Size**: `effectiveSize(name, packageSize, packageUnit)` → `{value, unit, pack}` canônico (reusa S231/S234).
4. **Variant**: `variantCanon(name)` ordena set determinístico (reusa S235 `extractVariants`).
5. **Bucketize**: chave composta `typeKey|sizeCanon|variantCanon`. Membros com mesma chave caem no mesmo bucket.
6. **Filter**: descarta buckets size < 2 (standalone) OU com < 2 brands distintas (Boss rule: equivalente exige marcas DIFERENTES).
7. **Assign**: gera cuid por grupo · `UPDATE products SET equivalent_group_id` nos membros · idempotente (re-run preserva ids existentes).

Dry-run default · `--apply` opt-in.

### Read path (backend)

`ProductsRepository.attachEquivalentMeta(products[])`:

1. Coleta `equivalentGroupId` únicos não-nulos do batch.
2. **1 query** carrega todos membros vivos dos grupos com seus top-1 price (isAvailable + supermarket.isActive).
3. Para cada produto: calcula `count = members.length` e `cheapest = argmin(price onde productId !== este)`.
4. Attach em `product.equivalentMeta`.

Zero N+1: 1 query extra por página de produtos (batched por groupId). Hooked em `findById`, `findManyByIds` (compare) e `findMany` (listagem/busca).

### DTO novos campos

`ProductResponseDto` ganha:
- `equivalentGroupId: string | null`
- `equivalentCount: number` (min 1)
- `cheapestEquivalent: { price, supermarketSlug, supermarketName, brand, productId } | null`

`fromEntity` lê `product.equivalentMeta` (se populado); default seguro `count=1, cheapest=null` quando não populado.

### Frontend badge amarelo

`EquivalentBadge` (`cesta-web/src/features/catalog/components/equivalent-badge.tsx`):
- Render condicional: `cheapestEquivalent !== null && equivalentCount > 1`.
- Visual: `bg-yellow-400 text-yellow-950` (contraste AA+), ícone `Shuffle` lucide.
- i18n: `"Equivalente desde 1,05 €"` (es) / `"Equivalente desde R$ 1,05"` (pt-BR). Tooltip inclui brand, supermarket, count.

Integrado em `ProductCard` (busca/home). `/comparar` CompareMatrix: nit P3 S246 — coluna separada "equivalente" fica fora do piloto.

## Boss guards (vinculantes · ADR 0046)

| # | Guard | Evidência |
|---|-------|-----------|
| 1 | Migration ADITIVA | `ADD COLUMN equivalent_group_id` + `CREATE INDEX` apenas. Zero DROP/DELETE/ALTER de colunas existentes. |
| 2 | LIGA não apaga | Script faz `UPDATE products SET equivalent_group_id` apenas. Zero DELETE. Preserva FKs (favorites/lists/alerts/reviews/snapshots). |
| 3 | PITR Neon antes `--apply` | Script imprime timestamp UTC + rollback SQL no `--apply`. |
| 4 | Dry-run default · idempotente | `--apply` opt-in. Re-run `--apply` reusa group_id existente, só mexe em quem está NULL ou mudou de grupo. |
| 5 | Rollback documentado | Ver seção abaixo. |
| 6 | Strict categoria + size + 2+ brands | `TYPE_PATTERNS` table restringe 5 categorias piloto; `effectiveSize` strict; `filterGroups` descarta < 2 brands. |
| 7 | Amostra 30 pré-apply | `SAMPLE_GROUPS=30` env default. Script imprime membros + brands antes do `--apply`. QA vista visualmente ≤5% erro. |
| 8 | G0 archive pointers | `docs/archive/pendente-note-2026-11-28-pre-s245.md` + `sprints-note-2026-11-28-pre-s245.md` · ponteiros via `maestri note edit` (Boss oversight 2026-11-28 scope expandido pre-S245). |

## Rollback

### Reverter links grupo (SQL)

```sql
-- Operador cola timestamp UTC impresso pelo script no --apply.
UPDATE products
   SET equivalent_group_id = NULL
 WHERE equivalent_group_id IS NOT NULL
   AND updated_at > '<timestamp UTC do --apply>';
```

Alternativa PITR Neon: branch do restore point pré-apply.

### Reverter schema

```sql
DROP INDEX IF EXISTS products_equivalent_group_id_idx;
ALTER TABLE products DROP COLUMN IF EXISTS equivalent_group_id;
```

### Reverter código

`git revert <sha_s245>` + push → Vercel + Render auto-deploy revertem. Frontend volta a mostrar só o badge verde S244 (mesmo produto).

## G/W/T DoD

**Given** um produto piloto (ex: "Leche entera Hacendado 1L" com `equivalentGroupId = eq_abc123`) com 2+ membros cross-brand no grupo,
**When** usuário abre `/produto/:id` OR vê o card na busca,
**Then** o response inclui `equivalentCount >= 2` + `cheapestEquivalent.price` = menor preço OUTRO membro + frontend renderiza `<EquivalentBadge>` amarelo com "Equivalente desde X€".

**Given** um produto fora do piloto 5 categorias (ex: "Coca-Cola Zero 2L"),
**When** usuário abre `/produto/:id`,
**Then** response tem `equivalentGroupId: null`, `equivalentCount: 1`, `cheapestEquivalent: null`, e frontend NÃO renderiza o badge amarelo.

**Given** script `match-equivalent.mjs` dry-run full em prod,
**When** executa `node scripts/match-equivalent.mjs --limit=20000`,
**Then** imprime N groups + total members + histogram por typeKey + sample 30 clusters pra QA visual review (target ≤5% erro, Boss rule).

## Trade-offs

- **Piloto 5 categorias limita cobertura**. Produtos fora (biscoitos, snacks, cosméticos, carne, limpeza) não ganham badge amarelo. Decisão deliberada pra medir impacto antes de expandir (ADR 0042 risco: typeKey canonicalization é regra de negócio, errar derruba precisão).
- **classifyTypeKey roda sobre `normalizeNameForMatch`**: patterns dependem do strip de genéricas ("sin" removido → "leche sin lactosa" vira "leche lactosa"). TYPE_PATTERNS foi ajustado pra essa forma; comentário no código documenta a dependência.
- **Boss rule "marcas DIFERENTES" descarta Hacendado+Hacendado** mesmo em supermercados distintos (falha de dedupe canonical anterior). Isso é correto: esses casos devem ter sido pegos pelo match-cluster (S244 canonical), não pelo equivalente.
- **cheapestEquivalent exclui o próprio produto**: badge mostra "mais barato que ESTE". Produto já cheapest do grupo → badge NÃO renderiza (zero incentivo visual confuso).
- **Overhead query: +1 por página de produtos** (batched). Cada grupo < 10 membros típico, custo << total page load. Monitorar após deploy via Sentry latência da rota.

## Consequências

- Usuário vê "equivalente desde X€" nos 5 categorias piloto → compara cross-brand sem sair do card.
- Mercadona (Hacendado dominante) deixa de parecer isolada na comparação pra esses casos.
- Métrica Boss baseline: % produtos com `equivalentGroupId != null` em prod medido após `--apply`.
- Follow-ups S246: (a) CompareMatrix coluna "equivalente" separada, (b) expansão categorias pós medição impacto, (c) página `/equivalente` dedicada se user signal positivo.
- Rollback SQL curto (UPDATE NULL ou DROP COLUMN) + revert commit → deploy auto.
