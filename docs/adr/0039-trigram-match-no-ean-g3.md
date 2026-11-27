# ADR 0039 — Matching cross-mercado G3: trigram (pg_trgm) para produtos sem EAN

- **Data:** 2026-11-27
- **Sprint:** S229 G3 (P0-CORE matching cross-mercado, chain pós ADR 0036+0037+0038)
- **Status:** Aceito (schema aditivo · script dry-run/apply · review queue para confiança média)
- **Relaciona:** ADR 0036 (G1 Aldi JSON-LD), ADR 0037 (G2 canonical merge FK), ADR 0038 (G1b audit), memory [[project-product-matching-gap]]

## Contexto

S228 G1+G2 cobriu matching por EAN exato. S229 G1b (ADR 0038) documentou que 4 adapters (DIA, LIDL, Eroski, Froiz) **não expõem EAN** nos endpoints usados hoje — somando ~70% do catálogo prod. Sem EAN, o `linkSupermarketDuplicate` nunca dispara → canonical merge fica em ~0.

G3 preenche essa ponte usando pg_trgm `word_similarity` sobre `normalized_name` + bônus por brand match. Matches de alta confiança (≥ HIGH_THRESHOLD) linkam direto via `Product.canonicalProductId`. Confiança média entra em fila manual (`product_match_reviews`).

## Decisão

### Schema (aditiva · Boss guard #1)

Nova tabela `ProductMatchReview`:

```prisma
model ProductMatchReview {
  id                 String   @id @default(cuid())
  duplicateProductId String   @map("duplicate_product_id")
  canonicalProductId String   @map("canonical_product_id")
  similarityScore    Decimal  @map("similarity_score") @db.Decimal(4, 3)
  status             String   @default("pending")
  createdAt          DateTime @default(now()) @map("created_at")
  reviewedAt         DateTime? @map("reviewed_at")

  duplicate Product @relation("MatchReviewDuplicate", fields: [duplicateProductId], references: [id], onDelete: Cascade)
  canonical Product @relation("MatchReviewCanonical", fields: [canonicalProductId], references: [id], onDelete: Cascade)

  @@unique([duplicateProductId, canonicalProductId])
  @@index([status, createdAt])
  @@map("product_match_reviews")
}
```

Inverse relations em `Product`: `matchReviewsAsDuplicate`, `matchReviewsAsCanonical`.

Migration `20261127190000_sprint229_product_match_review/migration.sql`: CREATE TABLE + 2 FKs CASCADE + UNIQUE pair + INDEX status+created_at. **Zero DROP/DELETE em schema existente**.

### Algoritmo trigram

Para cada **duplicate candidate** (ean IS NULL, canonicalProductId IS NULL, deletedAt IS NULL):

1. Encontra top-1 **canonical** (ean IS NOT NULL, canonicalProductId IS NULL) via SQL `CROSS JOIN LATERAL`:
   ```sql
   SELECT c.id, word_similarity(d.normalized_name, c.normalized_name) AS sim
   FROM canonicals c
   WHERE word_similarity(...) >= LOW_THRESHOLD
   ORDER BY sim DESC
   LIMIT 1
   ```
2. **Score composto**: `sim + (brand_match ? BRAND_BONUS : 0)`.
3. **Classificação**:
   - `score >= HIGH_THRESHOLD` (default 0.75) → **link direto** via `UPDATE products SET canonical_product_id = canonical.id` (filtro idempotente `canonical_product_id IS NULL`).
   - `LOW_THRESHOLD ≤ score < HIGH_THRESHOLD` → **INSERT** em `product_match_reviews` (`status='pending'`, `similarity_score`).
   - `score < LOW_THRESHOLD` → ignorado.

Config via env ou args: `--high=`, `--low=`, `--bonus=`, `--limit=` (default 0.75, 0.6, 0.1, 500).

Por que `word_similarity` em vez de `similarity`: `word_similarity(a, b)` compara trigrams de A contra o melhor substring de B, ignorando chars extras. Robusto para quando um nome tem palavras a mais (`"Coca-Cola Zero Azucar 2L"` vs `"Coca Zero 2 L"`).

Por que BRAND_BONUS: `word_similarity("coca-cola-zero", "mahou-cola-zero")` pode ficar alto (cola-zero compartilhado). Bonus de +0.1 quando marca coincide reduz false positives entre marcas competidoras.

Por que LATERAL top-1: não queremos N:N review rows por duplicate. O best match é o único considerado; se não bater ambos thresholds, o duplicate fica unlinked e pode ser rematado em runs futuros quando mais canonicais aparecerem.

### Script `scripts/match-trigram.mjs`

Dry-run default (Boss guard #4). `--apply` opt-in. Imprime:
- Thresholds em uso.
- Contagem high/review.
- Preview top-5 de cada tier.
- Snapshot Neon reminder no `--apply` (Boss guard #3).

Idempotente:
- UPDATE products usa `updateMany` com filtro `canonicalProductId IS NULL AND ean IS NULL` → re-run não toca linked.
- INSERT product_match_reviews catch UNIQUE conflict silencioso → re-run não duplica pares.

### Script `scripts/audit-trigram-match.mjs`

Read-only. Três views:
1. **Trigram linked**: `COUNT products WHERE canonicalProductId IS NOT NULL AND ean IS NULL`.
2. **Review queue**: por status (pending/approved/rejected), total + avg score.
3. **Top 200 itens básicos** (29 queries hardcoded: leche, pan, huevos, coca cola, …): canonicals + avg markets + max markets.

Boss metric: top itens com avg_markets ≥ 2 → sinal que G3 está surtindo efeito.

## Boss guards (vinculantes · herdados S228 G2 / S229 G1b)

| # | Guard | Evidência |
|---|-------|-----------|
| 1 | Migration ADITIVA · zero DROP/DELETE | `migration.sql`: CREATE TABLE + ADD CONSTRAINT + CREATE INDEX apenas |
| 2 | Match LIGA · NÃO apaga | `match-trigram.mjs` só faz `UPDATE products SET canonical_product_id = ?` (herdado G2) + `INSERT product_match_reviews`. Nunca `DELETE`. Preserva FKs em favorites/lists/alerts/reviews. |
| 3 | PITR Neon antes --apply em prod | script imprime reminder no `--apply`; PR body regista timestamp UTC + snapshot ID |
| 4 | Dry-run idempotente | `--apply` opt-in · filtro `canonicalProductId IS NULL` dedupe · UNIQUE constraint review table dedupe |
| 5 | Rollback documentado | ver seção abaixo |

## Rollback

### Reverter links trigram (duplicates linkados por este script)

Como diferenciar links G2 (EAN runtime) de links G3 (trigram script)? Timestamp do `--apply` + status review queue como pista:

```sql
-- Opção A: reverter TODOS os canonical links (destrutiva para G2 também).
UPDATE products SET canonical_product_id = NULL WHERE canonical_product_id IS NOT NULL;

-- Opção B: reverter apenas duplicates sem ProductPrice no supermarket
-- do canonical (sinal G3: adapter não re-linkou via EAN).
-- Requer análise caso-a-caso.

-- Opção C (recomendada): PITR Neon pra snapshot pré-apply.
```

### Reverter fila de review

```sql
-- Apaga review pendentes criados após o run:
DELETE FROM product_match_reviews
 WHERE created_at >= '<timestamp UTC do --apply>';
```

### Reverter schema

```sql
DROP TABLE IF EXISTS product_match_reviews;
```

CASCADE FK `onDelete: Cascade` em ambas relações de Product significa que soft-delete de Product (via `deletedAt`) NÃO toca a review (FK aponta `id`). Hard-delete do Product via cascade levaria a review também — intencional, previne dangling references.

## Trade-offs

- **Threshold tuning**: 0.75/0.60 são chute inicial. Ajustar baseado em precisão observada no review queue (se approved_rate >= 80% nos pending, mover HIGH_THRESHOLD pra baixo; se false-positive em linked, mover HIGH_THRESHOLD pra cima).
- **Review queue sem UI**: Boss/ops acessa via psql + flip `status`. UI pra revisar matches = scope futuro (G4 ou S230+).
- **LATERAL top-1 pode perder matches**: se canonical A e canonical B ambos bate em duplicate D com scores similares, só o top ganha. Em prática, trigram distribui bem; ties raros.
- **Zero runtime integration**: script é batch opt-in. Não roda no cron (evita custo recorrente e ambiguidade quando Boss quer rolar). Pós-estabilização, considerar runtime hook no catalog-sync.
- **Threshold BRAND_BONUS pode viciar**: produtos sem brand (NULL) nunca ganham bonus → score fica menor. Mitigação: brand-less products ainda qualificam pra link se word_similarity sozinho for alto. Documentar observado em sprints seguintes.

## Consequências

- `product_match_reviews` table serve como ponte entre matching automático e decisão humana para o terreno cinza.
- `canonicalProductId` (S228 G2 FK) ganha segundo caminho de população (trigram além de EAN).
- UI em G4 (sprint seguinte) filtra `canonicalProductId IS NULL` em ProductsRepository.findMany/findForSearch/findSuggestions → usuário vê catálogo deduplicado.
- Métrica Boss (% produtos ≥2 mercados + top 200 itens básicos): `audit-trigram-match.mjs` instrumenta.
- Rollback zero-downtime via PITR Neon + SQL UPDATE/DELETE.
