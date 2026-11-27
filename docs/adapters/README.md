# Catalog-sync adapters — summary

> **Sprint 223 consolidation.** Resumo dos 6 adapters shipados S217-S222 +
> rank próximas prioridades deep-dive pós-check 2026-11-28 07:00 CET.
> Baseline DB gravada 2026-11-27 pré-crons noturnos; delta esperado pós
> routine `bd22cd` resolve backlog G4 S218-S222.

## Patterns descobertos

Cada adapter caiu num pattern de descoberta distinto. 5 patterns formais
(ADR 0027-0031) + 1 informal (Mercadona tree, pré-ADR era). Growth por
pattern depende de 2 vetores: pool bruto (anchors / sitemap leaves / tree
depth) e dropout reduction (fetch/parse/dedup counters).

| Supermercado | Pattern | DB baseline 2026-11-27 | Ceiling teórico | Growth esperado pós-cron | ADR |
|---|---|---:|---:|---|---|
| Mercadona  | category-tree traversal          |  4070 |  ~4669 live (85% cov)       | neutro (tree completo; dropout G3 S217 pendente) | — |
| DIA        | SEED_QUERIES search-back         |  2979 |  ~6150 → ~12150 pós-S218    | +30-60% (expand 41→81 + dropout counters)       | 0027 |
| LIDL       | SEED_QUERIES search-back         |  1134 |  ~1880 → ~3807 pós-S222     | +15-25% (expand 43→81 + dropout counters)       | 0031 |
| Eroski     | sitemap + html-data-metrics      |   746 |  ~900 → ~4500 pós-S220      | +3-6× (cap 60→300 + lvl≥3 filter + dropouts)    | 0029 |
| Aldi       | sitemap + JSON-LD (detail pages) |   375 |  — (ceiling n/a, full crawl) | neutro (sitemap full; growth marginal)         | 0028 |
| Froiz      | sitemap + html-cards             |   366 |  ~400 → ~2010 pós-S221      | +3-5× (cap 60→300 + dropouts)                   | 0030 |
| **Total**  |                                  | **9670** | **~16K-27K pós-chain**   | +40-60% agregado esperado                       |      |

Volumes Mercadona 4070 inclui preço refresh overlap (DB conta ProductPrice
rows por supermercado); live-fetch distinto: `mad1` zone retornou 4669 em
S217 probe, cobertura ~85% sem dropout counters emitirem. Ceiling Aldi = DB
atual pois sitemap+JSON-LD cobre full catalog list sem filtros arbitrários.

## Pattern deep-dives

### 1. category-tree traversal (Mercadona, S217)
Endpoint público `/api/categories/<id>` retorna árvore completa (parent+
children). Walker recursivo carrega leaves. Sem query-driven: todo produto
descoberto pela própria estrutura hierárquica do catálogo. Cobertura teto
~95-100% da intenção merchant (mercadona expõe tudo que lista no site).

**Limitação principal:** sem dropout counters granulares. S217 G3
pendente (contadores de leaf fail / item parse / dedupe). Sem isso, não
dá pra confirmar coverage gap entre 4070 DB e 4669 live.

### 2. SEED_QUERIES search-back (DIA, LIDL)
Lista estática de ~81 queries vocabulário mercearia espanhola (leche /
yogur / pollo / aceite oliva / etc) chama endpoint `/search?q=<q>`.
Endpoint retorna 1a página de resultados (~47-150 anchors) sem paginação.
Growth atacável via 2 vetores: query expansion (DIA 41→81 S218, LIDL
43→81 S222) + dropout counters pra ver quanto cai na parse.

**Limitação principal:** teto de descoberta é intersecção
query-vocabulário × resultado. Produtos sem match em nenhuma seed ficam
invisíveis. Ceiling pre-dedup ~81 × median anchors; unique esperado
40-60% devido overlap.

### 3. sitemap + html-data-metrics (Eroski, S220)
`sitemap.xml` lista categoria URLs (1819 leaves em 2026-11-27). Filtro
`segments.length >= 3` isola folhas reais (1317 leaves), elimina ruído
lvl2 hubs (296 hubs retornam 0 tiles). Cada categoria page retorna HTML
SSR com tiles de produto e atributo `data-metrics` com ecommerce JSON
(item_id + price + brand + imagem). Sem fetch de página de produto
individual.

**Limitação principal:** depende de SSR estável do Eroski. Mudança de
template quebra silenciosa. Dropout counters S220 (9 contadores:
sitemapEmpty + categoryFetchFail + categoryNoTiles + tile{ParseFail,
NoItem, NoId, NoName, BadPrice, Duplicate}) mitigam.

### 4. sitemap + JSON-LD detail pages (Aldi, S219)
`sitemap.xml` lista produto URLs diretos. Crawl visita cada página,
extrai `<script type="application/ld+json">` com Product schema
(sku + name + offers.price + image). Full catalog guarantee desde que
sitemap seja autoritativo.

**Limitação principal:** fetch cost por produto (2x request vs tile
pattern: sitemap + detail). Aldi catalog pequeno (375) mantém custo
manejável. Scale-up pra catálogo grande proibitivo.

### 5. sitemap + html-cards (Froiz, S221)
`sitemap.xml` lista categoria URLs. Cada página retorna HTML com
cards de produto (sem JSON-LD, sem data-metrics). Cheerio extrai
nome + preço + imagem via selectors CSS. Mais frágil que
data-metrics (schema HTML não-stable) mas funciona pra sites
pequenos. S221 cap 60→300 destravou 5x ceiling.

### Decisões arquiteturais compartilhadas

Todos os adapters herdaram pattern comum pós-S217+:
- **polite-fetch** com jitter 2-5s + UA rotation + respeitando robots.txt
- **User-agent pool** rotação por fetch
- **CDN bare fetch** sitemap/robots via `bareFetch` (sem XHR headers que
  CDN Eroski filtra em IPs datacenter) vs `politeFetch` nas páginas HTML
- **Dropout counters** padrão: contadores granulares por motivo de
  descarte permitem debug yield baixo sem shell prod
- **Dedup intra-adapter** via `Set<externalId>` antes de emitir

## Deep-dive next priorities (pós-check 2026-11-28)

Rank provisório; final depende delta pós-cron routine `bd22cd`:

1. **Mercadona dropout counters (ADR TBD):** S217 G3 pendente. Sem
   counters, impossível explicar 85% coverage gap. P1 se growth agregado
   insuficiente pós-cron.

2. **DIA dropout counters add:** S218 shipou query expansion mas ainda
   sem dropout granular (parse fail / no price / dup). Add paridade LIDL
   S222 / Eroski S220. P2.

3. **Froiz lvl3+4 vs lvl2 filter decision:** S221 default filtra
   `segments.length >= 2` mas Eroski lição mostra lvl2 hubs geram 0
   tiles. Audit Froiz pra ver se mesmo pattern aplica → migrar pra
   `>= 3`. P2 se growth Froiz empírico abaixo expectativa.

4. **LIDL SEED expansion queda marginal:** S222 expand 43→81 mas
   unique esperado 1500-2300 (atual 1134). Se delta cron < +15%,
   investigar overlap inter-query real OU query bias (vocabulário
   não-match catálogo LIDL).

5. **Eroski cap 300 vs 1317:** S220 cap 60→300 deixou gap 300-1317
   leaves intocáveis. Se rate-limit live validar, S224+ pode remover
   cap default + env override.

6. **Aldi marginal:** full-crawl já cobre sitemap; nenhum dial fácil.
   Defer até catálogo crescer organicamente.

7. **Carrefour / Alcampo pós-MVP:** Akamai anti-bot bloqueia (ADR
   0009). ScrapingBee token disponível mas budget limitado; deferred
   pós-MVP decision.

## Baseline crons noturnos (referência)

Routine Maestri `bd22cd` dispara 2026-11-28 07:00 CET + diário. Grava
delta DB pós sincs 03:00-06:00 CET. Backlog G4 S218-S222 resolvido
empiricamente via este check — nenhuma sprint depende manualmente.

Ver também:
- [`docs/adr/0027-dia-adapter-query-expansion.md`](../adr/0027-dia-adapter-query-expansion.md)
- [`docs/adr/0028-aldi-sitemap-jsonld-crawl.md`](../adr/0028-aldi-sitemap-jsonld-crawl.md)
- [`docs/adr/0029-eroski-sitemap-datametrics-growth.md`](../adr/0029-eroski-sitemap-datametrics-growth.md)
- [`docs/adr/0030-froiz-sitemap-html-cards-growth.md`](../adr/0030-froiz-sitemap-html-cards-growth.md)
- [`docs/adr/0031-lidl-seed-queries-expansion.md`](../adr/0031-lidl-seed-queries-expansion.md)
