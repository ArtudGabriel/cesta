# ADR 0028 — Aldi adapter: shift de ofertas-only para sitemap + JSON-LD

- Status: Accepted
- Data: 2026-11-27
- Sprint: 219
- Decisão por: Dev (banda Cesta), aprovada por Manager via kickoff S219

## Contexto

Pre-S219, `aldi.adapter.ts` era um scrape single-endpoint de
`https://www.aldi.es/es/ofertas.html`. Essa página server-renderiza 192
tiles de produtos em promoção. Comentário S127 no adapter afirmava que
páginas de detalhe carregavam preço via JS (AEM), exigindo Puppeteer para
alcançar o catálogo completo (~2939 SKUs). Como consequência, o ceiling
real estava congelado em ~192 produtos e o DB prod estabilizou em ~145
(85% de coverage da página de promo, resto dropout por tile malformado
ou rotação de promoção).

Kickoff S219 pediu audit + growth pattern (SEED_QUERIES à la LIDL S186 /
DIA S218, OU dropout counters à la Mercadona S217) e justificativa por
PR + ADR caso a escolha fosse estrutural.

Aldi não encaixa em nenhum dos dois patterns:

- Não há endpoint de busca por query (nenhum `?q=...`).
- Não há árvore de categorias com SSR de tiles por página.
- Promoções rotacionam: SEED_URLS fixas não ampliam o ceiling fundamental.

## Probe empírico S219

Probes live em 2026-11-27 contra `www.aldi.es`:

1. `/robots.txt` expõe `Sitemap: https://www.aldi.es/.aldi-nord-sitemap.xml`.
2. `/sitemaps/.aldi-nord-sitemap-products.xml` → **2966 URLs `/producto/<slug>-<id>.html`**.
3. Fetch direto de `/producto/cerveza-clasica-50600.html` revela 5 blocos
   `<script type="application/ld+json">`; um deles tem
   `@type: "Product"` com `offers.price` SSR, `name`, `sku`, `brand`,
   `image[]`, `description`. **S127 estava errado**: preço está no HTML
   inicial via schema.org JSON-LD, não precisa JS/AEM.

Isso move o ceiling real de 192 → 2966 (~15× crescimento potencial).

## Decisão

Reescrita estrutural do adapter:

1. **Discovery**: `bareFetch` em `sitemap-products.xml` (pattern Eroski/Froiz,
   politeFetchRaw filtra Sec-Fetch headers de IPs datacenter) → lista
   2966 URLs de produto.
2. **Detail fetch**: para cada URL até o cap `ALDI_MAX_PRODUCTS`,
   `politeFetchRaw` + parse JSON-LD Product block → extrai
   `name`/`brand`/`sku`/`image`/`description`/`offers.price`.
3. **Overlay ofertas**: carrega `/es/ofertas.html` no início, extrai tiles
   de promoção; para cada produto do sitemap cujo `externalId` aparece
   nos tiles, aplica overlay `onPromotion=true` + `previousPrice` +
   substitui preço pelo tile (promo é mais atual que detail page).
4. **Dropout counters**: contam `sitemapEmpty`, `detailFetchFail`,
   `detailNoJsonLd`, `detailNoProductBlock`, `detailNoPrice`, `detailBadId`
   em log de encerramento (observability S217-style).
5. **Cap**: `ALDI_MAX_PRODUCTS` env, default 300. 2966 detail fetches
   com polite jitter 1-3s levariam ~1-2h por sync, inaceitável. 300
   SKUs ≈ 10-25min, meta G4 (≥50% growth 145→≥220) satisfeita com margem.
   Cap removido em sprint seguinte quando empírico confirmar estabilidade
   do padrão e rate-limit Aldi.

## Consequências

Positivas:
- Ceiling sobe de 192 → min(cap, 2966). Com cap 300 default, G4 (≥220)
  fica satisfeita com folga. Sem cap, 2966 vira ceiling real (~20× DB atual).
- Dados ricos: `brand`, `image`, `description` vêm estruturados do
  JSON-LD, não precisam regex frágil sobre tiles.
- Observability por default (dropout counters), paridade com Mercadona
  S217 / DIA S218.
- Promoções ainda capturadas via overlay ofertas → sem regressão de
  `onPromotion`/`previousPrice`.

Negativas / riscos:
- N+1 detail fetches: 300 req/sync vs 1 req/sync pre-S219. Mitigação:
  politeFetchRaw jitter 1-3s + cap configurável + próxima sprint avalia
  rate-limit real.
- Dependência de schema.org JSON-LD estável no site Aldi. Fallback: se
  JSON-LD sumir, dropout counter `detailNoProductBlock` vira indicador
  precoce e sprint seguinte retoma scrape de tiles via Cheerio.
- Tempo de sync longo: 10-25min por run com cap 300. Scheduler precisa
  acomodar (BullMQ job timeout).

Reversibilidade: trocar adapter de volta para html-scrape de ofertas é
`git revert` do commit S219. Overlay logic permanece como-é.

## Linka

- Mercadona S217 — dropout counters + tree discovery.
- DIA S218 — SEED_QUERIES expansion pattern.
- LIDL S186 — sitemap-less SEED_QUERIES.
- ADR 0027 — DIA query expansion (precedente de ADR sobre crescimento
  de adapter).
