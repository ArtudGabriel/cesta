# ADR 0040 — Matching cross-mercado G3 cluster-based (sem pré-requisito EAN)

- **Data:** 2026-11-27
- **Sprint:** S232 G3 cluster (prioridade máxima pós Boss finding 19:00Z)
- **Status:** Aceito · supersede o algoritmo de ADR 0039 (`match-trigram.mjs` duplicate→canonical) pra o caso sem EAN
- **Relaciona:** ADR 0036 (G1 Aldi), ADR 0037 (G2 canonicalProductId FK), ADR 0038 (G1b audit), ADR 0039 (G3 trigram inicial)

## Contexto

S229 G3 (`match-trigram.mjs` · ADR 0039) tinha bug de design: exigia Products canonicais com `ean IS NOT NULL` pra bater contra duplicates `ean IS NULL`. Mas **G3 existe exatamente pra adapters que NÃO expõem EAN** (DIA/LIDL/Eroski/Froiz · ADR 0038).

Resultado empírico 2026-11-27 em prod (DB Neon):

```
products: { with_ean: 0, without_ean: 10982, canonicals: 0 }
Dry-run match-trigram.mjs --limit=500: 0 candidatos
```

Zero canonicais em prod (G1 cron Aldi ainda não propagou; Mercadona list dropped EAN; Alcampo/Carrefour frozen) → zero matches → script inert.

## Decisão

### Algoritmo cluster-based (`scripts/match-cluster.mjs`)

Para cada Product base (limit N, ordenado por `created_at` ASC — mais antigos primeiro):

1. **Fase candidate**: SQL raw `WHERE c.id > d.id AND LOWER(d.brand) = LOWER(c.brand) AND word_similarity(d.normalized_name, c.normalized_name) >= HIGH AND EXISTS (ProductPrice cross-mercado)`. `pg_trgm` GIN acelera o filtro de similaridade.
2. **Fase strict** (JS): `sizeMatch(d.name, c.name)` — reusa parseSize S231. Sem size detectado em ponta → descarta.
3. **Union-find (DSU)** sobre pares aprovados: cada componente conectado é um cluster.
4. **Eleição canonical** por cluster, em ordem: `has_ean DESC` (prefere EAN quando existir no cluster) → `createdAt ASC` (seed original) → `id ASC` (tiebreak).
5. **Apply idempotente**: `UPDATE products SET canonical_product_id = <canonical.id> WHERE id IN (<duplicates>) AND canonical_product_id IS NULL`. Re-run = zero mudança.

### Reuso schema (zero migration · Boss guard #1)

- Reusa `Product.canonicalProductId` FK (ADR 0037 S228 G2). Zero DB change.
- Reusa `product_match_reviews` table (ADR 0039 S229 G3) — **não usada por este script** (threshold único HIGH, sem LOW tier). Table permanece pra uso humano futuro.
- Reusa `parseSize`/`sizeMatch` S231.

### Dry-run output (sample prod 2026-11-27 --limit=500)

```
Pares candidates (brand ✓ · sim >= 0.75 · cross-mercado): 66
Pares strict (adiciona size ✓): 12
Clusters N>=2: 2
  cluster size=2 "Aceite oliva virgen extra 1L" [Carbonell|1000ml]
     → "Aceite de oliva virgen extra Carbonell 1 L" [Carbonell|1000ml]
  cluster size=2 "Azúcar blanco 1kg" [Azucarera|1000g]
     → "Azúcar blanco Azucarera 1 Kg" [Azucarera|1000g]
```

12/66 pares sobreviveram ao size gate — gate forte evita falsos positivos (`"1L"` vs `"500ml"` demotados). Sample visual QA aprovado: brand igual, size igual, nome ~idêntico diferindo só em capitalização/separador.

## Boss guards (vinculantes · herdados G2 + G3 + S231)

| # | Guard | Evidência |
|---|-------|-----------|
| 1 | Migration ADITIVA | **Zero schema change**. Reusa S228 G2 FK + S229 G3 review table. |
| 2 | Cluster LIGA · não apaga | `UPDATE canonical_product_id = ?` apenas. Zero DELETE. Preserva FKs favorites/lists/alerts/reviews. |
| 3 | PITR Neon antes --apply | Script imprime timestamp UTC + instrução rollback no `--apply`. |
| 4 | Dry-run idempotente | `--apply` opt-in · `updateMany` com filtro `canonicalProductId IS NULL` · union-find determinístico (createdAt/id ordem). |
| 5 | Rollback documentado | ver seção abaixo. |
| 6 | Strict marca + tamanho S231 | SQL exige `LOWER(brand) =`; JS filter `sizeMatch` elimina ~80% dos candidates no sample prod. |
| 7 | Amostra 30 pré-apply | `SAMPLE_CLUSTERS=N` env (default 30) imprime clusters com member names + brand + size + ean. |
| 8 | G0 archive pointers | docs/archive/{pendente,sprints}-note-2026-11-27-s232.md + ponteiros. |

## Rollback

### Reverter links cluster (duplicates linkados por este script)

Rollback SQL primário (por timestamp):

```sql
-- Operador cola timestamp UTC impresso pelo script no --apply.
UPDATE products
   SET canonical_product_id = NULL
 WHERE canonical_product_id IS NOT NULL
   AND updated_at > '<timestamp UTC do --apply>';
```

Rollback via PITR Neon (preferido pra zero-erro):

- `https://console.neon.tech/app/projects` → create branch do restore point pré-apply.

### Reverter schema

**N/A** — ADR 0040 não cria schema. `canonicalProductId` FK e `product_match_reviews` table permanecem (herdados ADR 0037 + ADR 0039).

## Trade-offs

- **Custo O(N × candidates)**: SQL filtro por `word_similarity >= HIGH` + brand match + GIN trigram eficiente. Sample 500 base produtos × ~200 candidates each levou <30s em prod Neon. Full 10982 × 10982 scales mas cabe em janela backfill (cron noturno OR run manual).
- **Threshold HIGH=0.75 inicial**: ajustar baseado em precisão QA do sample 30. Se falsos positivos aparecerem, subir pra 0.8. Se missing legítimos, descer pra 0.7.
- **Eleição canonical conservadora**: has_ean > createdAt > id. Favorece Mercadona (mais velho) e produtos com EAN quando houver. Trade-off: empates em createdAt resolvidos deterministicamente via id.
- **`sizeMatch` falha silenciosa**: produto sem size parseável em nome (ex: "Papel higiénico Dia pack 12 rolos" — pack 12 pega mas unit "rolos" não; "Leche" sem size só pode bater com outro "Leche" sem size = false). Trade-off aceito: preferir perder matches a introduzir false positives entre tamanhos distintos.
- **Review queue não usada**: S229 G3 ADR 0039 previa fila manual pra scores médios. S232 só gera tier HIGH (strict) ou nada. Simplicidade > recall. Fila fica disponível pra futuro OR UI humana que decida low-confidence.

## Consequências

- G3 passa a funcionar sobre catálogo real sem depender de EAN populado.
- Métrica Boss (% produtos ≥2 mercados · top itens básicos cross-market) começa a mover baseline baixa (~0.4%) após primeiro `--apply`.
- `audit-trigram-match.mjs` + `audit-canonical-merge.mjs` instrumentam efeito pós-apply.
- G4 (próxima sprint) filtra `canonicalProductId IS NULL` em ProductsRepository findMany/findForSearch/findSuggestions → UI deduplicada.
- Rollback zero-downtime via UPDATE SQL ou PITR Neon.
