# ADR 0034 — Price stale indicator (`isStale` flag + UI badge)

- **Data:** 2026-11-27
- **Sprint:** S226 (price stale indicator · cesta.md regra visível)
- **Status:** Aceito
- **Relaciona:** ADR 0025 (bandwidth budget), ADR 0033 (daily cron LIDL+Aldi)

## Contexto

`cesta.md` regra:

> **UI mostra aviso quando `isStale=true`** (preço não atualizado há > X horas por falha do adapter).

Sem o badge, o usuário não distingue entre:

1. **Preço fresh:** último `catalog-sync` passou (dentro das últimas 24-48h), valor ainda vale.
2. **Preço stale:** cron falhou, adapter quebrou, ou produto saiu do catálogo e estamos mostrando valor velho.

Impacto GDPR (cesta.md Sprint 59 §3): quando o adapter falha silenciosamente, mostrar preço velho sem aviso induz o usuário a decidir compra errada. Legalmente é aceitável porque preço público não é PII, mas é má experiência e mina a confiança no "catálogo em tempo quase-real" (cesta.md §Propósito).

### Fontes do stale

- Adapter down (DNS, 403 anti-bot, 500 do site da rede)
- Rate-limit interno (throttler) pulou um ciclo
- Deploy Render spin-down + cron missed
- `lastSyncedAt` na row `ProductPrice` fica parado > threshold

Hoje já temos `ProductPrice.lastSyncedAt` escrito em todo `catalog-sync` run. Falta expor `isStale` no DTO e consumir no UI.

## Decisão

### Threshold

`PRICE_STALE_THRESHOLD_HOURS` em `cesta-api/src/config/env.validation.ts`:

- Default: **48 horas** (dois dias; absorve janela weekly cron se um ciclo falhar).
- Range: inteiro ≥ 1.
- Validação graciosa: valor inválido ou vazio → fallback 48 (parseStaleThresholdHours).
- Lido **uma vez no load** do módulo (zero `process.env` por request), em `STALE_THRESHOLD_MS` constant.

### Backend

`cesta-api/src/modules/products/dtos/product-response.dto.ts`:

1. `computeIsStale(lastSyncedAt, now?, thresholdMs?)` — helper puro, exportado pra testes unit sem acoplar `Date.now`. `null`/inválido → `true` (worst-case transparent; preço ausente nunca engana).
2. `PriceByMarketDto.isStale: boolean` — por mercado.
3. `ProductResponseDto.isStale: boolean` — mirror do cheapest price (home card / /produto). Quando produto não tem preço disponível → `false` (sem badge; `cheapestPrice=null` já cobre o caso).

Favoritos (`cesta-api/src/modules/favorites`):

- Repository seleciona `lastSyncedAt` no join.
- Service propaga `isStale` no `CheapestPriceDto`.

### Frontend

Componente `StaleBadge` em `cesta-web/src/features/catalog/components/stale-badge.tsx`:

- Consome `product.isStale` ou `price.isStale` — nunca decide localmente, nunca lê `Date.now`.
- Chip amber-100 + icon Clock + i18n `catalog.stale.label` + tooltip `catalog.stale.tooltip`.
- `data-sentry-unmask` (chrome informativo público, sem PII).
- Tamanhos `sm` (cards) e `md` (product detail).

Integração 4 telas (DoD):

| Tela | Fonte | Local |
|------|-------|-------|
| `/` home | `product.isStale` | `ProductCard` (abaixo do chip supermarket, ao lado de Promo/Discount) |
| `/produto/[pid]` | `product.isStale` | `ProductDetailBody` (abaixo do `cheapestPrice` hero) |
| `/favoritos` | `fav.cheapestPrice?.isStale` | `FavoritosPage` list item (abaixo do price/unit price) |
| `/minha-lista/[id]` | `cheapest.isStale` (PriceByMarketDto) | `ListItemRow` |

### i18n

ES:
- `catalog.stale.label`: "Desactualizado"
- `catalog.stale.tooltip`: "Este precio no se actualiza hace más de 48 horas."

PT-BR:
- `catalog.stale.label`: "Desatualizado"
- `catalog.stale.tooltip`: "Este preço não é atualizado há mais de 48 horas."

## Trade-offs

- **48h é generoso.** LIDL/Aldi weekly promovidas a daily (ADR 0033) reduzem janela esperada pra ~24h max. 48h evita falso positivo em dias de cron missed isolado. Reavaliar quando todos adapters forem daily ≥ 30 dias.
- **Fallback `null` → `true`.** Row sem `lastSyncedAt` sinaliza adapter novo ou corruption. Preferimos false-positive (usuário vê badge) a false-negative (preço velho sem aviso).
- **Zero `Date.now` no componente.** Backend calcula tudo; front renderiza boolean. Evita skew por timezone browser e faz o campo testável no spec sem freezer de tempo.
- **Não quebra API.** Novo campo opcional do ponto de vista do client — mas DTO baseline agora exige `isStale: boolean`. Baseline regenerado via `types:api` captura o contrato.

## Consequências

- `cesta.md` regra fechada: badge visível quando `isStale=true`.
- Baseline OpenAPI atualizado: `PriceByMarketDto` + `ProductResponseDto` + `CheapestPriceDto` ganham campo `isStale: boolean` obrigatório.
- Observabilidade: Sentry breadcrumb `recordProductsFetch` já carrega `resultCount` — considerar adicionar `staleCount` em sprint futura pra alertar quando % stale explodir (indica adapter crash em massa).
- Rollback trivial: env `PRICE_STALE_THRESHOLD_HOURS=999999` desativa badges na prática (nunca stale) sem code change.
