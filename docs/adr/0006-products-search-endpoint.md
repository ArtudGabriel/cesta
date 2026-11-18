# ADR-0006 — Endpoint `/products/search` dedicado ao ProductPicker (Sprint 106)

**Status:** Accepted · **Data:** 2026-11-18

## Contexto

Sprint 61 criou `GET /products/suggest` como autocomplete do campo de busca
global (catalog header). Shape da resposta:

```json
{
  "suggestions": [
    { "id": "...", "name": "...", "brand": "...",
      "imageUrl": "...", "cheapestPrice": { "value", "supermarketSlug", "supermarketName" } }
  ]
}
```

Sprint 105 shippou wizard de alert rules (combo/bundle) aceitando `productIds`
como string crua de CUIDs separados por vírgula. TODO(S106) explícito no
código marcou a dívida: swap pra ProductPicker com autocomplete real.

Em S106 o ProductPicker precisa buscar produtos pra alimentar um multi-select
no wizard. Reusar `/suggest` tem três atritos:

1. **Shape**: payload de `/suggest` é feito pra UI do catalog header (mostra
   brand + cheapest price card com nome do mercado). O picker só quer
   `{id, name, imageUrl, price}` — brand e supermarket metadata não entram
   no chip nem na linha do dropdown. Carregar esse extra em bulk (10 items
   × N mercados) encarece payload sem valor.
2. **Validation layer**: `/suggest` usa `class-validator` (padrão pré-S105).
   SDD-lite (adotado em S105 pra features grandes) pede Zod no boundary.
   Migrar `/suggest` seria uma mudança cruzando scope (quebra autocomplete
   do header).
3. **Semântica de total**: picker precisa saber "há mais 50 matches além
   dos 10 mostrados" pra decidir mostrar "muitos resultados, refina".
   `/suggest` omite total propositalmente.

## Decisão

Criar endpoint novo `GET /products/search` com Zod boundary, shape otimizado
pro picker, e rate limit 20/60s (mais apertado que o default de 120/60s
porque é typeahead — cada keypress após debounce dispara 1 request).

**Trade-off aceito**: duplicação parcial com `/suggest`. Ambos fazem
`ILIKE %q%` em name/brand. Justificativa:

- Shapes divergem suficientemente pra que uma transformação compartilhada
  no serviço seria tão volumosa quanto duplicar a query repo.
- `/suggest` tem cliente ativo (catalog header) e contrato público; mexer
  nele puxa frontend junto.
- Débito mínimo: função de 50 linhas no repo. Fácil consolidar depois
  (S110+) se surgir terceiro consumidor.

## Alternativas descartadas

**A) Estender `/suggest` com `?shape=compact` query param**
Rejeitada: polimorfismo de response em query param é confuso pra OpenAPI
tooling (gen de types falha em `oneOf` sem discriminator). Melhor 2 rotas.

**B) Reusar `/products` com `search=term&limit=10`**
Rejeitada: `/products` faz paginação + sort complexo + filtros (brand,
category, vegan, promotion), tudo via class-validator. Response vem com
array de prices expandidos. Payload gigante pra autocomplete.

**C) Frontend-only fuzzy match em cache**
Rejeitada: catálogo tem milhares de produtos, dataset não cabe em
localStorage, cache não reflete updates do catalog-sync.

## Consequências

Positivas:
- Picker tem contrato enxuto e previsível.
- Zod no boundary = erro de validation visível no PR via diff do schema.
- Rate limit dedicado protege DB contra typeahead abusivo sem apertar
  endpoints caros de catalog.
- `data-sentry-mask` no picker wrapper mantém GDPR (query do user é PII
  — revela interesse de compra).

Negativas:
- Duplicação ILIKE em 2 lugares (`findSuggestions` e `findForSearch` no
  mesmo repository). Aceito pelos motivos acima.
- Novo endpoint público sem auth — IP-based throttle é a única barreira.
  Mesmo risco de `/suggest` e `/products` (já públicos em S61/S72).

## Rollback

Reverter o commit do S106 remove endpoint, dto, service method e o
ProductPicker. Wizard volta ao raw CUID input. Nenhum migration de DB
envolvido — mudança 100% application layer.
