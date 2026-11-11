# CLAUDE.md — Cesta

> **Leitura obrigatória antes de qualquer sessão de código:**
> 1. [`claude-geral-consolidado.md`](./claude-geral-consolidado.md) — padrões globais (stack, nomenclatura, camadas, templates)
> 2. [`cesta.md`](./cesta.md) — documento de produto (features, regras, roadmap)
> 3. [`cesta-identidade-visual.md`](./cesta-identidade-visual.md) — design system

Este arquivo *estende* o `claude-geral-consolidado.md` com contexto específico do Cesta. Não duplicar padrões globais aqui.

---

## Projeto

- **Nome:** Cesta
- **Propósito:** App mobile-first (PWA) de comparação de preços de supermercados para a Comunidade de Madrid. Catálogo em tempo quase-real, controle de gastos via OCR de notas, alertas de preço, avaliações de produtos e cesta familiar personalizada.
- **Status atual:** scaffolding inicial (Layer 1 — infra base)
- **Idiomas UI:** Espanhol (padrão) e Português Brasileiro

---

## Stack (divergências do default)

**Segue 100% o default** (NestJS + Next.js 15 + Prisma + PostgreSQL + Tailwind + shadcn/ui + Docker + BullMQ + Redis + Zod + React Query + Zustand + Axios).

Divergências/ênfases:
- **PWA**: `cesta-web` configurado como PWA com manifest + service worker (`next-pwa` ou equivalente)
- **OCR**: biblioteca Tesseract.js (ou serviço externo) dentro do worker BullMQ `receipts`
- **i18n**: `next-intl` no frontend; mensagens traduzidas em `es.json` + `pt-BR.json`

---

## Arquitetura específica

```
cesta/
├── CLAUDE.md
├── cesta.md
├── cesta-identidade-visual.md
├── claude-geral-consolidado.md
├── docker-compose.yml
├── .env.example
├── _prototype/           ← protótipo original do Perplexity (referência visual)
├── cesta-api/            ← backend NestJS
└── cesta-web/            ← frontend Next.js 15
```

### Módulos previstos (backend)

| Módulo | Responsabilidade |
|--------|------------------|
| `auth` | Register/login (email ou telefone), JWT access/refresh, guards globais |
| `users` | CRUD de usuários, perfil, preferências de idioma |
| `supermarkets` | Catálogo de redes (Mercadona, Carrefour, etc.) |
| `products` | Catálogo de produtos + categorias + info nutricional |
| `product-prices` | Preço atual + histórico (`PriceSnapshot`) por produto/supermercado |
| `catalog-sync` | Adapters por rede + jobs BullMQ de ingestão |
| `reviews` | Avaliações e comentários de produtos |
| `favorites` | Favoritos do usuário |
| `alerts` | Alertas de preço do usuário + verificador |
| `receipts` | Scan de nota fiscal (upload + job OCR) |
| `expenses` | Compras registradas + dashboard de gastos |
| `family-profiles` | Perfil familiar (membros + respostas + restrições) |
| `family-baskets` | Cesta familiar gerada (worker BullMQ) |
| `notifications` | Push notifications via BullMQ |

### Features frontend (telas)

| Rota | Função |
|------|--------|
| `/(auth)/login` · `/(auth)/register` | Login/cadastro email ou telefone |
| `/` | Home: busca + categorias + promoções do dia |
| `/produto/[pid]` | Detalhe + preços por mercado + nutrição + reviews |
| `/comparar` | Comparação direta multi-produto |
| `/gastos` | Scan/upload de nota + dashboard |
| `/alertas` | Lista + criação |
| `/minha-cesta/configurar` | Wizard familiar |
| `/minha-cesta` | Cesta gerada editável |
| `/perfil` | Idioma + localização + favoritos + config |

---

## Regras de negócio chave

- **Preços sempre em `€` com 2 casas decimais**. Nunca float — `Decimal(10,2)` no Prisma, `z.number().multipleOf(0.01)` no front.
- **Preços nunca vêm do frontend**. Toda escrita de preço passa por `catalog-sync` (oficial) ou `price-correction` (crowdsourced via receipt).
- **OCR é job assíncrono**. Endpoint de upload de nota retorna 202 + `jobId`.
- **Geração de cesta familiar é assíncrona**. Trigger retorna 202; cesta fica acessível quando o job conclui.
- **1 review por usuário por produto** (`@@unique([userId, productId])`).
- **Regenerate de cesta** preserva items com `isLocked=true` ou `isRequired=true`; só substitui os demais.
- **Usuário anônimo não existe**: review, favorito, alerta, receipt, cesta familiar — tudo requer login.
- **Login por email OU telefone**. User model tem ambos opcionais, pelo menos um obrigatório.
- **Confiança de preço** (`confidenceScore` em `ProductPrice`): fonte oficial = 1.00; crowdsourced 3+ confirmações = 0.90; 1 confirmação = 0.50.
- **UI mostra aviso quando `isStale=true`** (preço não atualizado há > X horas por falha do adapter).

---

## Integrações previstas

- **Fontshare** (fontes Satoshi + Cabinet Grotesk) — carregadas via `next/font/local` após download
- **Mercadona API** (`tienda.mercadona.es`) — adapter `mercadona.adapter.ts`
- **Carrefour/Alcampo/DIA** — endpoints JSON do e-commerce
- **Froiz** — scraping HTML (Cheerio)
- **LIDL/Aldi** — folleto PDF + OCR (fase 2)
- **Tesseract.js** — OCR de notas fiscais (worker `receipts`)
- **Twilio / SNS** — SMS para login por telefone (fase 2; MVP pode começar só com email)
- **Web Push API** — notificações (via BullMQ worker)

---

## Escopo da sessão atual

**Layer 1 — Infra base + repositórios:**
1. Scaffold `cesta-api` (NestJS + Prisma + estrutura common/config/database)
2. Scaffold `cesta-web` (Next.js 15 + Tailwind + shadcn/ui com tokens Cesta)
3. `docker-compose.yml` com Postgres + Redis
4. `.env.example` + `.gitignore`
5. Init git + repositório GitHub privado

**Próximas layers (ordem):**
- Layer 2: módulo `auth` (email/telefone + JWT + refresh)
- Layer 3: módulos `supermarkets` + `products` + seed inicial (importar Google Sheets do Perplexity)
- Layer 4: módulo `reviews`
- Layer 5: módulos `family-profiles` + `family-baskets` + worker de geração
- Layer 6: `catalog-sync` (primeiro adapter: Mercadona)
- Layer 7: `receipts` + OCR + `price-correction`
- Layer 8: `alerts` + `notifications`

---

## Particularidades / pegadinhas

- **Diretório na raiz `OneDrive`** — OneDrive pode fazer sync agressivo. Preferir desabilitar sync em `node_modules/` via `.nosync` ou mover projeto futuramente para fora do OneDrive se der problema.
- **PowerShell é o shell padrão**. Scripts devem respeitar sintaxe PS; alternativamente usar bash via WSL/git-bash.
- **Google Sheets do Perplexity** é o seed inicial do catálogo — importar antes de começar features que dependem de produtos.
- **Legal**: scraping tem área cinza. Cada adapter respeita robots.txt, User-Agent identificado, rate-limit baixo (1 req/s), cache agressivo (máx 1 fetch/dia por produto).
- **Preço por geolocalização**: Mercadona varia por CEP. MVP ignora; fase 2 armazena `postalCode` em `ProductPrice`.

---

*Estende `claude-geral-consolidado.md`. Não duplicar padrões globais aqui.*
