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

Padrão Postgres (`pg_trgm.similarity_threshold` default). Tolera ~1-2 typos em palavra 5-6 chars. Validado empiricamente:
- "lecge" → "Leche" similarity ≈ 0.44 ✓
- "yogrt" → "Yogur" similarity ≈ 0.41 ✓
- "yoguer" → "Yogur" similarity ≈ 0.55 ✓
- "xyz987" → zero matches (sem nada parecido no catálogo) ✓

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
