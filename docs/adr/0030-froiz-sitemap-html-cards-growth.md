# ADR 0030 — Froiz adapter: 5º pattern sitemap+html-cards + cap 60→300 + dropout counters

- Status: Accepted
- Data: 2026-11-27
- Sprint: 221
- Decisão por: Dev (banda Cesta), aprovada por Manager via kickoff S221

## Contexto

Pre-S221, `froiz.adapter.ts` fazia:

1. `bareFetch` em `sitemap.xml` → ~8287 URLs.
2. Filtra URLs não-`/product/` com `LEAF_DEPTHS = {3,4}` → folhas lvl3+4.
3. Fatia primeiras `FROIZ_MAX_CATEGORIES` (default **60**) e para cada uma `politeFetchRaw` + Cheerio extrai cards `.product-grid .product` com nome/preço/promo no DOM.

DB prod ~**366 produtos**. Cap 60 × avg ~6.7 cards/leaf = ceiling teórico ~400. Coverage efetiva ~91% do cap — próxima ao limite imposto pelo cap, não pelo adapter em si.

Kickoff S221 pediu audit + growth, com 4 patterns possíveis já conhecidos (SEED_QUERIES / category-tree / sitemap+JSON-LD / sitemap+html-data-metrics) + unknown 5th.

## Probe empírico S221

Live probes 2026-11-27 contra `supermercado.froiz.com` via `scripts/audit-froiz-adapter.mjs`:

1. **Pattern identificado: sitemap + html-cards** (5º distinct pattern da banda). Nem Mercadona (API tree), nem DIA/LIDL (SEED_QUERIES), nem Aldi (JSON-LD em detail page), nem Eroski (data-metrics ecommerce JSON no tile). Froiz tem só **DOM cards puros** em `.product-grid .product` — sem IDs estáveis, sem EAN, sem structured data. Match no DB via `normalizedName` (S116 auto-create).
2. Sitemap distribuição:
   - totalLocs: 8287
   - productLocs: 7105 (`/product/` — não usadas atualmente)
   - categoryLocs: 1182
   - byDepth cats: {0:1, 1:25, 2:113, 3:558, 4:485}
3. Fetches de amostra (Cheerio `.product-grid .product`):
   - lvl3 `/alimentacion/pastas-y-masas/pasta-para-sopa-fideos-y-fideua` → **14 cards**
   - lvl3 `/carniceria/ternera-y-vaca/vaca` → **3 cards**
   - lvl4 `/alimentacion/cafes-e-infusiones/cafes-y-cereales-solubles/grano-mezcla` → **3 cards**
   - avg: ~**6.7 cards/leaf** (sample 3 — alta variância, folhas de nicho pequenas)
4. Conclusão: lvl3+4 são folhas reais; filtro atual `LEAF_DEPTHS={3,4}` (1043 URLs) é correto. Cap 60 limita ceiling a ~400 — bottleneck atual.

## Decisão

Duas mudanças mínimas no adapter (pattern geral mantido, nenhuma reescrita):

1. **Cap default: `DEFAULT_MAX_CATEGORIES` 60 → 300**. Ceiling teórico vai de ~400 → ~2010 (300 × avg 6.7 cards). DB atual 366 vira ~18% do novo ceiling; 82% headroom para crescimento. 300 fetches × polite jitter 1–3s ≈ 10–15 min por sync, cabe no scheduler BullMQ sem timeout. `FROIZ_MAX_CATEGORIES` env continua override em prod.
2. **Dropout counters observability** (paridade Eroski S220 / Mercadona S217 / Aldi S219):
   - `sitemapEmpty` (0 locs após filtro)
   - `categoryFetchFail` (politeFetchRaw retornou null)
   - `categoryNoTiles` (HTML OK mas 0 cards)
   - `tileNoName` / `tileNoPrice` / `tileBadPrice`
   - `tileNoId` (slug derivation falhou)
   - `tileDuplicate` (externalId já visto no run)

Log final de `fetchProducts` expõe todos. Debug yield baixo sem shell prod.

## Alternativas descartadas

- **Usar os 7105 /product/ URLs diretos do sitemap**: cada /product/ page seria 1 fetch adicional — ~7k fetches × 1–3s = 2–3 horas/sync. Inviável sem queue dedicada. Além disso, /product/ não traz preço no server-side rendering (hidrata client-side), exigiria headless browser. Descartado.
- **Switch para JSON-LD detail page (pattern Aldi S219)**: Froiz detail pages são Nuxt SSR mas não expõem JSON-LD estruturado. Scraping do detail page precisaria dos mesmos selectors DOM + 1 fetch extra por produto. Descartado.
- **SEED_QUERIES pattern (LIDL S186 / DIA S218)**: Froiz não expõe endpoint de busca por query path confiável; a URL `/search?q=...` existe mas é client-side route sem SSR. Descartado.
- **Category-tree traversal (Mercadona S217)**: Froiz não tem API JSON de categorias; sitemap é o único discovery. Descartado.
- **Remover cap totalmente**: 1043 fetches × 1–3s jitter ≈ 30–50 min/sync, estourava job timeout BullMQ default. Postergado pra sprint seguinte quando empírico validar rate-limit Froiz + tempo.

## Consequências

Positivas:
- Ceiling teórico sobe de ~400 → ~2010 (**5× crescimento potencial**). G4 target (366 → ≥440, +20%) satisfeito com grande margem assumindo cobertura real similar aos samples.
- Dropout counters viram sinal precoce de drift: se Froiz mudar DOM schema (ex `.product-grid` → `.products-list`), `categoryNoTiles` sobe antes do catálogo quebrar silenciosamente.
- **5º pattern distinct** catalogado. Catálogo adapter patterns agora:
  1. Mercadona — category-tree (API JSON)
  2. DIA/LIDL — SEED_QUERIES (search-back)
  3. Aldi — sitemap + JSON-LD (detail page)
  4. Eroski — sitemap + html-data-metrics (list page ecommerce JSON)
  5. Froiz — sitemap + html-cards (list page DOM)

Negativas / riscos:
- Tempo de sync sobe de ~3 min → ~10–15 min. Aceitável; cron noturno.
- Cap 300 ainda <1/3 do total de folhas lvl3+4 (1043). Próxima sprint avalia expand ou remoção baseado em métricas empíricas pós-G4.
- DOM selector-dependent — qualquer rebrand do site Froiz (classes CSS) quebra scrape; dropout `categoryNoTiles` alerta precoce.
- Sem EAN e sem product-id estável; match no DB via `normalizedName` pode gerar colisões entre produtos similares de marcas diferentes (risco S116 geral, não Froiz-específico).

Reversibilidade:
- Retorno a `DEFAULT_MAX_CATEGORIES = 60`: 1 constante, dropout counters ficam no adapter sem custo.
- Git revert do commit S221 restaura estado exato pre-S221.

## Linka

- Mercadona S217 (ADR implícita) — dropout counters + tree discovery.
- DIA S218 — ADR 0027 SEED_QUERIES expansion pattern.
- Aldi S219 — ADR 0028 sitemap + JSON-LD rewrite.
- Eroski S220 — ADR 0029 sitemap + html-data-metrics + cap 60→300.
- LIDL S186 — ADR 0016 sitemap-less SEED_QUERIES.
