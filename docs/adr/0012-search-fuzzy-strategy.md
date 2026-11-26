# ADR 0012 — Search fuzzy strategy (/products/suggest)

**Status:** Accepted
**Date:** 2026-11-26
**Sprint:** S180 (pós-S179 gate 4 G1 FAIL design flaw)

## Context

S106 shippou `/products/suggest` com Prisma `contains + mode:'insensitive'` — exact substring match. User digita "lecge" (typo de "leche") → zero suggestions, dropdown vazio.

S179 tentou mitigar via Fuse.js **post-fetch** no frontend (opção A inline do scope S179). QA gate 4 G1 FAIL: Fuse só re-ranka dataset já retornado — quando backend retorna zero (ILIKE não match typo), Fuse não tem nada pra fuzzy. Design flaw.

## Decision

**Opção A — Postgres `pg_trgm` extension com `similarity()` + GIN index**, fallback quando ILIKE retorna zero matches.

### Mecânica

1. Migration `20261126000000_sprint180_pg_trgm`:
   - `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
   - GIN indices em `Product.name` e `Product.brand` com `gin_trgm_ops`.
2. `ProductsRepository.findSuggestions`:
   - Primeiro tenta Prisma `contains` (comportamento atual preservado — cobre 95% dos casos sem typo, zero latency change).
   - Se `rows.length === 0` e `q.length >= 3`, fallback raw `$queryRaw` com `similarity(name, q) > 0.3 OR similarity(brand, q) > 0.3` + `ORDER BY GREATEST(...)` DESC.
   - Resultado trigram IDs → segundo query ORM pra montar shape completo (prices + supermarket relation).

### Threshold 0.3

Padrão Postgres (`pg_trgm.similarity_threshold` default). Tolera ~1-2 typos em palavra 5-6 chars.

### Sprint 181 UPDATE: `similarity()` → `word_similarity()`

Diagnose Neon prod empírico (S181) revelou que `similarity()` falha quando nome do produto tem palavras extras:

| query | text | similarity() | word_similarity(q, text) |
|---|---|---|---|
| `lecge` | `leche` | 0.333 | — |
| `lecge` | `Leche entera 1L` | **0.158** ❌ | **0.5** ✓ |
| `yogrt` | `yogur` | 0.333 | — |
| `yogrt` | `Yogur natural 4x125g` | **0.125** ❌ | **0.5** ✓ |
| `yoguer` | `Yogur griego Dia` | — | 0.571 ✓ |
| `xyz987` | `*` | — | < 0.3 → [] ✓ |

**Root cause:** `similarity()` compara trigramas da **string inteira** — nome produto 15+ chars dilui score vs query 5 chars. `word_similarity(query, text)` compara query trigrams vs **melhor substring** do text, ignora resto.

**Fix S181:** `$queryRaw` usa `word_similarity(${q}, "name") > 0.3` + `word_similarity(${q}, "brand") > 0.3`. GIN `gin_trgm_ops` acelera ambos operadores.

### Sprint 182 — Ordering boost direct-match

Nit P3 S181: `q='lecge'` retornava `'Surtido bombones chocolate con leche Navidad'` antes de `'Leche entera brik 1L'`. `word_similarity` ranqueia por density — produto longo com target em contexto ganha vs produto curto standalone. User espera direct match (produto começando com palavra correspondente) no topo.

**Fix cumulativo** (boost aditivo sobre word_similarity base):

| Boost trigger | Valor | Cobre |
|---|---|---|
| `LOWER(name) LIKE LOWER(q) \|\| '%'` OU `LOWER(name) ~ '(^\|\s)LOWER(q)'` | +0.3 | Baseline sem typo (q='leche' → "Leche entera*") |
| `word_similarity(q, SPLIT_PART(name, ' ', 1)) >= 0.5` | +0.3 | Typo cases (q='lecge' → first_word="Leche" word_sim=0.5) |

Baseline sem typo acumula +0.6 (ambos triggers); typo case acumula +0.3 (só first-word fuzzy). Threshold filter `WHERE word_similarity > 0.3` preservado; boost só afeta ORDER BY.

**Empírico Neon pós-fix:**
- `"lecge"` top 8 → todos "Leche*" / "Lechuga*" (first-word fuzzy), "Chocolate con leche" fora do top ✓
- `"yogrt"` top 8 → todos "Yogur*" ✓
- Baseline `"leche"` / `"yogur"` top 8 preservado (score 1.60 cumulativo) ✓

Futuro: ajustar via env `PG_TRGM_THRESHOLD` se telemetria mostrar falsos positivos (threshold mais alto = menos recall).

## Consequences

### Positive

- G1 QA S179 resolvido: typo no meio/fim da palavra agora encontra match.
- GIN index acelera tanto `similarity()` quanto `ILIKE %q%` (gin_trgm_ops serve ambos).
- Latency: Prisma `contains` continua first-try (hot path); trigram fallback só quando zero matches.
- Zero breaking downstream: response shape identical.
- Preserva S179 Fuse frontend como **re-rank secundário** (cobre ordering edge cases pós-fetch).

### Negative

- Migration adiciona extension + 2 índices (~alguns MB em catálogo 8632 produtos; negligível).
- Raw `$queryRaw` precisa manutenção manual se schema Product.name/brand mudar tipo.
- Trigram não entende ordem de palavras (ex: "leche entera" vs "entera leche" similarity boa pra ambos).

### Neutral

- Fuse frontend mantido (não remove S179 lib). Bundle 12KB preservado.

## Alternatives considered

- **B — Fuse.js apenas client-side (S179 approach):** rejeitado — G1 FAIL design flaw. Só re-ranka dataset fetched; zero matches = nada a fuzzy.
- **C — pg_trgm Prisma generated accessor:** Prisma 7 não gera helpers nativos pra operador `%` ou `similarity()`. Raw query aceitável; alternative seria Prisma client extension custom (overhead).
- **D — Elasticsearch / Typesense / Meilisearch dedicated:** scope enorme + custo (Meilisearch Cloud free tier 100MB; Typesense self-host requires VPS). Deferido pós-MVP se telemetry mostrar necessidade.

## Verification

- `cesta-api` jest: regression specs adicionadas em `products.repository.spec.ts` (mock prisma $queryRaw fallback).
- Migration aplica limpa em dev + prod Neon (pg_trgm supported).
- QA empírico prod: queries "lecge", "yogrt", "yoguer" → matches reais via `/products/suggest?q=`.

## References

- S179 PR #136 (Fuse.js frontend — re-rank layer secundária preservada)
- S106 `/products/suggest` endpoint original
- Postgres pg_trgm docs: https://www.postgresql.org/docs/current/pgtrgm.html
- Memory `project-mvp-definition` Bloco 4 / cesta.md §3.1 Catálogo discoverability
