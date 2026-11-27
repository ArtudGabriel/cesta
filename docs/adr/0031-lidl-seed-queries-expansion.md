# ADR 0031 — LIDL adapter: SEED_QUERIES 43→81 + MAX_QUERIES 40→81 + dropout counters

- Status: Accepted
- Data: 2026-11-27
- Sprint: 222
- Decisão por: Dev (banda Cesta), aprovada por Manager via kickoff S222

## Contexto

Pre-S222, `lidl.adapter.ts` fazia:

1. `politeFetchRaw` em `https://www.lidl.es/q/search?q=<query>&type=json` com SEED_QUERIES declarado (43 queries).
2. `MAX_QUERIES = 40` truncava array declarado para 40 primeiras queries (array tinha 43 — bug mudo).
3. Extrai produtos via regex `erpNumber` anchor + `parseSegment`.

DB prod LIDL = **1134** (baseline gravada Boss 2026-11-27, após correções 908→1029→1134). Ceiling pre-S222 teórico ~40 × 47 anchors ≈ 1880; coverage ~60% do cap. Cap limita antes do endpoint.

Kickoff S222 pediu LIDL recheck + queries expansion, pattern S218 DIA (41→81).

## Probe empírico S222

Live probes 2026-11-27 contra `www.lidl.es/q/search`:

Sample 12 queries (5 existentes + 7 novos candidatos):
- `leche` 48, `yogur` 48, `platano` 48 (existentes)
- `cebolla` 46, `pimiento` 47, `croissant` 46, `salchicha` 48, `bacalao` 47, `gambas` 48, `pienso perro` 48, `vinagre` 46, `pasta dentifrica` 47 (novos)

Avg ~**47 anchors/query**. Endpoint sem paginação, teto fixo por query. Todos candidatos novos produtivos (46-48, mesma faixa que existentes).

## Decisão

Três mudanças mínimas no adapter (pattern SEED_QUERIES mantido, nenhuma reescrita estrutural):

1. **SEED_QUERIES 43 → 81** (alinhado DIA pós-S218). Gap-fill Spanish grocery vocabulary:
   - Dairy variants: `nata`, `batido`, `kefir`
   - Bakery subs: `tostadas`, `bollo`, `croissant`, `magdalena` (substitui `bolleria`)
   - Cured meat specifics: `carne picada` (vs `carne`), `bacon`, `salchicha`, `hamburguesa`, `lomo` (vs `embutido`)
   - Seafood: `bacalao`, `gambas`, `mejillones` (vs `pescado`)
   - Produce staples: `cebolla`, `pimiento`, `ajo`, `limon`, `zanahoria`, `pepino`, `aguacate`, `brocoli`
   - Drinks breadth: `coca cola`, `cafe`, `te` (vs apenas `refresco`)
   - Pantry: `aceite oliva` (specific), `vinagre`, `mayonesa`, `ketchup`, `chocolate`, `miel`, `garbanzos`, `lentejas`
   - Frozen/snack specifics: `pizza congelada`, `patatas fritas`, `frutos secos` (vs `pizza`/`congelado`)
   - Cleaning breadth: `bolsas basura`, `lavavajillas`, `suavizante` (+ substitui `papel` por `papel higienico`)
   - Hygiene: `desodorante`, `toallitas`, `panales`
   - Pet: `pienso perro`, `pienso gato`

2. **`MAX_QUERIES` 40 → 81**. Elimina trunc do array declarado e habilita novos seeds.

3. **Dropout counters observability** (paridade Froiz S221 / Eroski S220 / Mercadona S217 / DIA S218):
   - `queryFetchFail` (politeFetchRaw retornou null)
   - `queryNoAnchors` (HTML OK mas 0 erpNumber matches)
   - `segmentNoId` / `segmentNoName` / `segmentNoPrice` / `segmentBadPrice`
   - `segmentDuplicate` (externalId já visto)

Log final de `fetchProducts` expõe todos. Debug yield baixo sem shell prod.

## Alternativas descartadas

- **Discovery via sitemap LIDL**: LIDL não publica sitemap útil de produtos (sitemap.xml tem só páginas estáticas). Query endpoint continua o único discovery confiável.
- **Scrape listagem /es/<categoria>/**: paginação client-side JS; sem SSR de preço no HTML da listagem. Exigiria headless browser. Descartado.
- **JSON-LD detail page**: LIDL detail pages têm JSON-LD mas visitar seria N queries extras pós-anchors; o próprio segmento já traz preço. Descartado.
- **Remover cap totalmente**: 81 queries × 2-5s jitter ≈ 2-7 min/sync — aceitável; manter cap explícito como guardrail contra accidental descompass no array.

## Consequências

Positivas:
- Ceiling teórico sobe de ~1880 → ~**3807** (pre-dedup). Com dedup 40-60% esperado unique ~1500-2300.
- **G4 target 1134 → ≥1304 (+15%)** altamente provável (margem significativa dado ~65% headroom ceiling pós-expansão). Routine QA delta check agendada 2026-11-28 07:00 CET pós-cron noturno.
- Dropout counters viram sinal precoce de drift: se LIDL mudar schema `"erpNumber"` ou estrutura `"price":{...}`, dropout levels sobem antes do catálogo quebrar silenciosamente.
- Catálogo adapter patterns pós-S222: DIA + LIDL ambos pattern SEED_QUERIES 81 queries alinhado — pattern estável.

Negativas / riscos:
- Tempo de sync sobe ~2 min → ~5-7 min por aumento de 41 queries. Aceitável; cron noturno.
- Alguns novos seeds podem ter alta overlap com existentes (ex `salchicha` vs `chorizo`/`embutido`), reduzindo ganho marginal. Sinal via dropout `segmentDuplicate` pós primeiro sync empírico.
- Rate-limit LIDL não observado em probe, mas 81 queries sequenciais × polite jitter 2-5s = ~4-7 min de tráfego sustentado. Não observado WAF/block.

Reversibilidade:
- `MAX_QUERIES = 40` restaura cap antigo. SEED_QUERIES reduzir pra primeiros 43 restaura estado pre-S222. Dropout counters ficam no adapter sem custo.
- Git revert do commit S222 restaura estado exato.

## Linka

- Mercadona S217 (ADR implícita) — dropout counters + tree discovery.
- DIA S218 — ADR 0027 SEED_QUERIES expansion pattern (fonte do approach).
- Aldi S219 — ADR 0028 sitemap + JSON-LD rewrite.
- Eroski S220 — ADR 0029 sitemap + html-data-metrics + cap 60→300.
- Froiz S221 — ADR 0030 sitemap + html-cards + cap 60→300.
- LIDL S186 — ADR 0016 sitemap-less SEED_QUERIES (origem do adapter LIDL).
