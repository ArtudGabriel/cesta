# ADR 0029 — Eroski adapter: filtro lvl>=3 + cap 60→300 + dropout counters

- Status: Accepted
- Data: 2026-11-27
- Sprint: 220
- Decisão por: Dev (banda Cesta), aprovada por Manager via kickoff S220

## Contexto

Pre-S220, `eroski.adapter.ts` fazia:

1. `bareFetch` em `sitemap.xml` → lista 1819 URLs.
2. Filtra URLs com `/es/supermercado/<...>/<...>/` e `segments.length >= 2` → 1613 URLs restantes.
3. Fatia primeiras `EROSKI_MAX_CATEGORIES` (default 60) e para cada uma `politeFetchRaw` + Cheerio extrai tiles `.product-title-link[data-metrics]` com ecommerce JSON SSR embutido.

DB prod estabilizou em **746 produtos**. Cap 60 × avg ~15 tiles/leaf = ceiling teórico ~900. Coverage efetiva ~85% do cap — próxima ao limite imposto pelo cap, não pelo adapter em si.

Kickoff S220 pediu audit + growth, com 4 patterns possíveis já conhecidos (SEED_QUERIES / category-tree / sitemap+JSON-LD / outro).

## Probe empírico S220

Live probes 2026-11-27 contra `supermercado.eroski.es` via `scripts/audit-eroski-adapter.mjs`:

1. **Pattern identificado: sitemap + html-data-metrics** (4º distinct pattern da banda; nem query, nem tree, nem JSON-LD em detail page). O tile de listagem já carrega JSON ecommerce SSR no atributo `data-metrics`; o adapter nunca precisa visitar páginas de detalhe.
2. Sitemap distribuição por nível (segments after `/es/supermercado/`):
   - lvl 1: 200 URLs
   - lvl 2: 296 URLs
   - lvl 3: 946 URLs
   - lvl 4: 371 URLs
3. Fetches de amostra confirmaram:
   - `lvl 2 /...frescos/carniceria/` → **0 tiles SSR** (hub sem listagem direta)
   - `lvl 2 /...bodega/vinos/` → **0 tiles** (hub)
   - `lvl 2 /...frescos/frutas/` → 20 tiles (hub-folha híbrido, raro)
   - `lvl 3 /...frutas/naranjas-y-otros-citricos/` → 19 tiles reais
4. Conclusão: lvl 2 são mayoritariamente **hubs sem SSR de tiles**. Lvl 3+ são folhas reais com ~15–20 tiles cada. Filtro antigo `>= 2` (1613 URLs) inflava a lista com ~296 hubs puros que produziriam `categoryNoTiles` sem contribuir produto.

## Decisão

Três mudanças mínimas no adapter (nenhuma reescrita estrutural, pattern geral mantido):

1. **Filtro sitemap: `segments.length >= 3`** (constante `MIN_CATEGORY_SEGMENTS = 3`). Reduz pool de 1613 → 1317 folhas lvl3+, elimina hubs lvl2 improdutivos.
2. **Cap default: `DEFAULT_MAX_CATEGORIES` 60 → 300**. Ceiling teórico vai de ~900 → ~4500 (300 × avg 15 tiles). DB atual 746 vira ~17% do novo ceiling; 83% headroom para crescimento. 300 fetches × polite jitter 1–3s ≈ 10–15 min por sync, cabe no scheduler BullMQ sem timeout. `EROSKI_MAX_CATEGORIES` env continua override em prod.
3. **Dropout counters observability** (paridade Mercadona S217 / Aldi S219):
   - `sitemapEmpty` (0 locs após filtro)
   - `categoryFetchFail` (politeFetchRaw retornou null)
   - `categoryNoTiles` (HTML OK mas 0 tiles)
   - `tileParseFail` (data-metrics ausente ou JSON inválido)
   - `tileNoItem` (ecommerce.items vazio)
   - `tileNoId` / `tileNoName` / `tileBadPrice`
   - `tileDuplicate` (externalId já visto)

Log final de fetchProducts expõe todos. Debug yield baixo sem shell prod.

## Alternativas descartadas

- **Reescrita sitemap+JSON-LD em detail page (pattern Aldi S219)**: Eroski já tem dado estruturado no tile da listagem, visitar detail page seria N×15 fetches extras sem ganho estrutural (dado idêntico ao data-metrics). Descartado.
- **SEED_QUERIES Spanish grocery gap (pattern LIDL S186 / DIA S218)**: Eroski não expõe endpoint de busca via query path confiável. Descartado.
- **Category-tree traversal (pattern Mercadona S217)**: Eroski não tem API JSON de categorias; o único discovery é o sitemap. Descartado.
- **Remover cap totalmente**: 1317 fetches × 1–3s jitter ≈ 40–60 min/sync, estourava job timeout BullMQ default. Postergado pra sprint seguinte quando empírico validar rate-limit Eroski + tempo.

## Consequências

Positivas:
- Ceiling teórico sobe de ~900 → ~4500 (**5× crescimento potencial**). G4 target (746 → ≥895, +20%) satisfeito com grande margem assumindo cobertura real similar aos samples.
- Dropout counters viram sinal precoce de drift: se Eroski mudar schema data-metrics, `tileParseFail` ou `tileNoItem` sobem antes do catálogo quebrar silenciosamente.
- Pattern discovery fica documentado como 4º padrão da banda (próximas sprints podem buscar outros adapters com mesma forma).

Negativas / riscos:
- Tempo de sync sobe de ~3–5 min → ~10–15 min. Aceitável; cron noturno.
- Cap 300 ainda <1/4 do total de folhas lvl3+ (1317). Próxima sprint avalia expand ou remoção baseado em métricas empíricas pós-G4.
- Filtro >=3 pode perder lvl2 hubs raros que SSR-rendem tiles (ex `frutas` com 20 tiles observados). Trade-off aceito pelo baixo yield relativo desse tipo de hub + redução significativa de ruído.

Reversibilidade:
- Retorno a `MIN_CATEGORY_SEGMENTS = 2` + `DEFAULT_MAX_CATEGORIES = 60`: 2 constantes, dropout counters ficam no adapter sem custo.
- Git revert do commit S220 restaura estado exato pre-S220.

## Linka

- Mercadona S217 (ADR implícita) — dropout counters + tree discovery.
- DIA S218 — ADR 0027 SEED_QUERIES expansion pattern.
- Aldi S219 — ADR 0028 sitemap + JSON-LD rewrite.
- LIDL S186 — ADR 0016 sitemap-less SEED_QUERIES.
