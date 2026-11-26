## ADR 0027 - DIA adapter growth via SEED_QUERIES expansion

- **Data:** 2026-11-27
- **Sprint:** S218
- **Status:** Aceito

## Contexto

Pós-S217 refutou tese "SEED_QUERIES expand" para Mercadona (pattern category-tree,
cobertura 85% pré-expansao). Pivô para DIA (~2945 produtos DB, segundo maior
volume Cesta). MVP catálogo depth exige crescer DIA.

Antes de propor qualquer mudança, S218 kickoff exigia audit classificando o
pattern do adapter DIA (SEED_QUERIES list vs category-tree vs other) e
estimando ceiling.

## Investigação (G1 audit)

`scripts/audit-dia-adapter.mjs` extrai estaticamente:

- **Pattern:** `SEED_QUERIES` (array de 41 termos em `dia.adapter.ts`)
- **Endpoint:** `GET https://www.dia.es/api/v1/search-back/search?q=<query>&page=<N>`
- **Paginacao:** `page_size=30`, cap `MAX_PAGES_PER_QUERY=5`
- **Ceiling por query:** ~150 produtos pre-dedup
- **Ceiling teorico pre-S218:** 41 × 150 = 6150
- **Cobertura estimada:** 2945 / 6150 = ~48%
- Nao existe endpoint `category-tree` publico conhecido (S122 descobriu apenas
  search-back). Tree discovery ficaria especulativa sem evidencia.

Live probe de dev-IP retorna HTTP 403 (CDN filtra datacenter IPs mesmo com UA
realista; coerente com memoria `feedback-cdn-bare-fetch`). Prod sync pelo
`politeFetch` com UA rotation funciona.

## Decisao

1. **Query expansion path (NAO tree discovery).** DIA adapter SEED_QUERIES
   expandido de 41 para 81 termos. Gaps preenchidos:
   - dairy variants (nata, batido, kefir)
   - bakery subs (tostadas, bollo, croissant, magdalena)
   - cured meat (bacon, salchicha, hamburguesa, lomo)
   - shellfish (bacalao, gambas, mejillones)
   - produce staples (cebolla, pimiento, ajo, limon, zanahoria, pepino,
     aguacate, brocoli)
   - drinks (refresco, cafe, te)
   - pantry (vinagre, mayonesa, ketchup, chocolate, miel, garbanzos, lentejas)
   - snacks (patatas fritas, frutos secos)
   - cleaning (lavavajillas, suavizante)
   - hygiene (toallitas, panales)
   - pet (pienso perro, pienso gato)

   Ceiling teorico pos-expansao: 81 × 150 = 12150 (~2x).

2. **Regression guard:** spec `dispara pelo menos 70 queries distintas`
   previne cosmetic drop de seeds em edits futuros.

3. **G4 empirical growth fica user-dep.** Trigger manual do sync via admin UI
   acontece pos-deploy; medir produtos novos DIA no DB >=10% (>=3240 total).

4. **Pattern analogo a LIDL S186** (41 queries expanded -> +988 produtos novos).
   Aplicavel aqui porque DIA search-back nao expoe "list all" e cobertura
   depende do surface de termos.

## Consequencias

- Request budget por sync DIA aumenta: 41q × 5p = 205 requests -> 81q × 5p =
  405 requests (max). Jitter 2-5s mantem polite-fetch budget sob controle.
- Dedup via `seen` Set absorve overlap entre queries proximas (nata ∩ leche
  etc). Dedup custo O(n) desprezivel.
- Se expansao futura saturar (<5% novos por batch), lever secundaria =
  dropout reduction via Logger counters raw/kept/noPrice/invalidPrice.
- Nao aplicavel a Mercadona (ver ADR implicita em
  `project-mercadona-adapter-architecture`). Cada adapter audit primeiro.

## Alternativas descartadas

- **Category-tree discovery DIA:** nenhum endpoint publico conhecido; S122
  live probe nao expoe. Nao propor sem evidencia nova.
- **Live probe no audit script:** dev-IP CDN block 403; fallback a leitura
  estatica + `SyncRun` DB = ground truth suficiente.
- **Expansao incremental 10 queries por sprint:** diluiria sinal; S186 provou
  que uma expansao larga mede melhor o ceiling real pos-dedup.
