# ADR 0043 — Supermarket logos placeholder (S242 #8)

## Status
Accepted · 2026-11-27

## Context
Badges de supermarket na UI renderizavam `supermarketName.slice(0, 2).toUpperCase()` (ex: "ME", "AL", "CA", "DI") dentro de um círculo colorido com `supermarketColor`. Visualmente opaco e pouco discriminativo pra usuário espanhol que conhece os logos das redes; o Boss listou como P2 polish #8 ("logos mercados no lugar de 'ME'/'AL'").

Alternativas consideradas:
1. **CDN externa** (Clearbit, logo.dev) — fetch de terceiros, risco privacy + URL instável + latência extra.
2. **Logos oficiais checked-in** — copyright: redes não liberam brand assets pra reuso. Usar sem autorização expõe o projeto a takedown.
3. **Placeholders SVG brand-colored** (escolhido) — asset local, zero network, drop-in compatível com logos oficiais no futuro.

## Decision
Entregar `public/supermarkets/<slug>.svg` com 40x40 viewBox, círculo brand-colored + 2 letras maiúsculas brancas (ou azul LIDL pra contraste em fundo amarelo). Mesmo filename/viewBox dos logos oficiais que eventualmente sejam licenciados — swap é drop-in sem tocar código.

`SupermarketBadge` component (`features/catalog/components/supermarket-badge.tsx`):
- `<img src={/supermarkets/<slug>.svg} alt={name} />` por padrão.
- `onError` → fallback `<span>` com `supermarketColor` + `name.slice(0, 2).toUpperCase()`. Mesmo visual do pré-S242 — zero quebra se o asset falhar (404, offline).
- Props: `slug`, `name`, `color?`, `size?` (default 40), `className?`, `forceFallback?` (jsdom tests).

Callers substituídos no bundle S242:
- `features/catalog/components/price-comparison-grid.tsx`
- `features/shopping-lists/components/hybrid-basket-card.tsx`
- `features/shopping-lists/components/totals-by-market.tsx`

## Consequences
**Positivo**
- UX melhor sem violação de copyright.
- Swap pra logo oficial é edit de 1 arquivo SVG, zero mudança de código.
- Fallback mantém comportamento legado — zero regressão visual se o asset falhar em produção.

**Negativo**
- Visual atual continua text-heavy (não é logo real). Resolver com arte própria OU acordo de licença por adapter.
- Requer manter o diretório `public/supermarkets/` alinhado com `SUPERMARKETS` do seed (`cesta-api/prisma/seed.ts`). Novo mercado adicionado no seed precisa de SVG correspondente (ou fallback fica ativo).

## Rollback
Reverter os 3 call sites pro `<span bg=color>{name.slice(0, 2)}</span>` original. SVGs ficam no `public/` sem efeito (não referenciados). `SupermarketBadge` pode ser removido no mesmo revert ou mantido unused pra futuro re-enable.
