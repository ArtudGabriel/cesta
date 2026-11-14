# Cesta

[![CI](https://github.com/ArtudGabriel/cesta/actions/workflows/ci.yml/badge.svg)](https://github.com/ArtudGabriel/cesta/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/ArtudGabriel/cesta/branch/main/graph/badge.svg)](https://codecov.io/gh/ArtudGabriel/cesta)

App mobile-first (PWA) de comparação de preços de supermercados para a Comunidade de Madrid. Catálogo em tempo quase-real, controle de gastos via OCR de notas fiscais, alertas de preço, avaliações de produtos e cesta familiar personalizada.

**Idiomas:** Español · Português (Brasil)

---

## Documentação

- [`cesta.md`](./cesta.md) — Documento de produto (features, regras, roadmap)
- [`cesta-identidade-visual.md`](./cesta-identidade-visual.md) — Design system
- [`claude-geral-consolidado.md`](./claude-geral-consolidado.md) — Padrões de desenvolvimento
- [`CLAUDE.md`](./CLAUDE.md) — Contexto do projeto para o assistente

---

## Estrutura

```
cesta/
├── cesta-api/      # Backend (NestJS)
├── cesta-web/      # Frontend (Next.js 15)
├── _prototype/     # Protótipo original (Perplexity) — referência visual
└── docker-compose.yml
```

---

## Setup (dev)

```bash
# 1. Variáveis de ambiente
cp .env.example .env
# edite .env com segredos reais (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET)

# 2. Serviços de infra
docker compose up -d

# 3. Backend
cd cesta-api
npm install
npx prisma migrate dev
npm run start:dev          # http://localhost:3001

# 4. Frontend (em outro terminal)
cd cesta-web
npm install
npm run dev                # http://localhost:3000
```

> **Nota:** mudanças em `cesta-web/next.config.ts` ou em `src/i18n/messages/*.json` exigem `Ctrl+C` + `npm run dev` novamente — Turbopack não hot-reload esses arquivos.

---

## Stack

- **Backend:** NestJS + Prisma + PostgreSQL 16 + BullMQ + Redis
- **Frontend:** Next.js 15 (App Router) + Tailwind + shadcn/ui + React Query + Zustand
- **Validação:** class-validator (back) + Zod (front)
- **Auth:** JWT access 15min + refresh 7d
- **Containers:** Docker + docker-compose

---

## CI & Branch Protection

GitHub Actions executa `lint` + `test` + `build` em `cesta-api` e `cesta-web` a cada push/PR em `main` (`.github/workflows/ci.yml`).

**Admin do repo**, para habilitar branch protection:

1. Settings → Branches → Branch protection rule → `main`
2. Require status checks to pass before merging:
   - `API (lint + test + build)`
   - `Web (lint + typecheck + build)`
3. Require branches to be up to date before merging
4. (Opcional) Require pull request reviews before merging

Run local equivalente antes de abrir PR:

```bash
# API
cd cesta-api && npm ci && npx prisma generate && npm run lint --if-present && npm run audit:dtos && npx jest && npm run build
# Web
cd cesta-web && npm ci && npm run lint --if-present && npx tsc --noEmit && npm run build
```

### Coverage policy (Sprint 43 web + Sprint 56 api + Codecov)

CI roda `npm run test:coverage` em ambos os lados (`cesta-web` via vitest+@vitest/coverage-v8, `cesta-api` via jest+istanbul), sobe os artifacts `coverage-report` e `coverage-api` (retention 7 dias), e tenta enviar o `lcov.info` de cada lado pro Codecov com flags `web` e `api` (passo `continue-on-error: true` — sem `CODECOV_TOKEN` configurado, o upload falha graceful, CI segue verde).

**Thresholds atuais** (baseline - 5pp):

| Métrica | Web (Sprint 43) | API (Sprint 56) | Baseline API |
|---|---|---|---|
| Statements | 6% | 9% | 12.46% |
| Branches | 3% | 2% | 7.35% |
| Functions | 4% | 4% | 9.6% |
| Lines | 6% | 9% | 12.04% |

Política: incrementar threshold incrementalmente a cada 5-10 sprints (ex: +5pp). Zero regressão aceita — PR cai se coverage despenca abaixo do threshold.

Pra habilitar upload Codecov em prod: criar conta em [codecov.io](https://codecov.io), autorizar o repo, copiar o token, adicionar como secret `CODECOV_TOKEN` no GitHub Actions. Em repo público o upload funciona sem token, só mais lento.

Antes de abrir PR:

```bash
cd cesta-web && npm run test:coverage
# → stats no terminal + coverage/index.html (HTML report)
```

Download report em prod: GH Actions run → Artifacts → `coverage-report`.

---

## Deploy

Stack free-tier: **Neon** (Postgres) + **Upstash** (Redis) + **Render** (API NestJS) + **Vercel** (Web Next.js). Sprint 23 preparou tudo — `render.yaml` blueprint + health check + graceful shutdown + env docs.

### 1. Neon — Postgres

1. https://neon.tech → criar projeto free
2. Copiar connection string (formato `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`)
3. Guardar — vai em `DATABASE_URL` do Render

### 2. Upstash — Redis

1. https://upstash.com → criar Redis database free
2. Copiar `TLS connection URL` (formato `rediss://default:token@endpoint.upstash.io:6380`)
3. Guardar — vai em `REDIS_URL` do Render

### 3. Render — API

1. https://render.com → New → Blueprint → conectar GitHub repo `ArtudGabriel/cesta`
2. Render detecta `cesta-api/render.yaml` automaticamente
3. Preencher vars **sync: false**: `DATABASE_URL` (Neon), `REDIS_URL` (Upstash), `CORS_ORIGIN` (URL Vercel após step 4)
4. Vars **generateValue: true** (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) o Render preenche
5. Deploy. Primeira build leva ~5min (npm ci + prisma migrate deploy + nest build)
6. Health check em `/health` — Render polling automático, 503 = unhealthy marker
7. Copiar URL pública (ex `https://cesta-api.onrender.com`)

> **Cold start free tier:** após 15min idle, próxima request leva ~30s. Plano pago (US$ 7/mês) remove spin-down.

### 4. Vercel — Web

1. https://vercel.com → Import Project → repo `ArtudGabriel/cesta`
2. Root Directory: `cesta-web`
3. Framework: Next.js (auto-detect)
4. Env var: `NEXT_PUBLIC_API_URL=https://cesta-api.onrender.com/api/v1` (URL do step 3 + `/api/v1`)
5. Deploy
6. Voltar no Render e setar `CORS_ORIGIN=https://cesta.vercel.app` (URL Vercel) → redeploy API

### 5. Validar

```bash
curl https://cesta-api.onrender.com/health
# -> { "status": "ok", "checks": { "db": {...}, "redis": {...} } }
```

Portal no navegador: Vercel URL → login → navegar. Primeira request pode levar ~30s (cold start Render). Subsequentes instantâneas.

Variáveis de referência: [`.env.example`](./.env.example) (api) + [`cesta-web/.env.example`](./cesta-web/.env.example) (web).

### 6. Sentry (opcional — Sprint 31 errors + Sprint 55 Performance/source maps + Sprint 58 Replay/spans + Sprint 59 GDPR mask hardening)

Observabilidade de erros + performance + session replay em prod. Sem DSN, SDK fica no-op e app roda normal.

1. https://sentry.io → criar 2 projetos (NestJS + Next.js) → copiar DSN de cada
2. Render → envVars → preencher `SENTRY_DSN` (sync: false já configurado em `render.yaml`); `SENTRY_TRACES_SAMPLE_RATE` já setado em `0.1` no `render.yaml` (10% traces em prod)
3. Vercel → Environment Variables → `NEXT_PUBLIC_SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1`
4. Redeploy ambos. 5xx + non-HttpException do backend capturados via `AllExceptionsFilter`; erros React via `<SentryBoundary />` no `layout.tsx`; Performance tracing captura p95, slow transactions, DB query time, fetches RSC automaticamente

#### Source maps upload CI (Sprint 55)

Pra stack traces legíveis em prod (minificação Next/Nest apaga nomes):

1. Em Sentry: Settings → Auth Tokens → criar token com scope `project:releases` + `org:read` → copiar
2. Sentry Organization/Project settings → copiar slug `SENTRY_ORG` + `SENTRY_PROJECT`
3. GitHub repo → Settings → Secrets and variables → Actions → adicionar 3 secrets:
   - `SENTRY_AUTH_TOKEN` (token do passo 1)
   - `SENTRY_ORG` (slug)
   - `SENTRY_PROJECT` (slug)
   - `NEXT_PUBLIC_SENTRY_DSN` (opcional — se setado, build CI já roda com tracing habilitado no bundle)
4. Vercel: mesmos 4 secrets como Environment Variables (Build-time). `withSentryConfig` em `next.config.ts` gatilha upload automático quando `SENTRY_AUTH_TOKEN` presente.
5. `deleteSourcemapsAfterUpload: true` garante que os `.map` não vazam no bundle final de prod — ficam só no Sentry.
6. Sem secrets → `sourcemaps.disable: true` kicks in → build normal sem upload (dev local + CI de PR público permanecem iguais).

#### Session Replay (Sprint 58)

Grava interação do user na página pra reproduzir bugs reportados dentro do painel Sentry (replay com DOM mutations + console logs + network).

- Vercel envs: `NEXT_PUBLIC_SENTRY_REPLAY_SAMPLE_RATE=0.05` (5% das sessões) + `NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=1.0` (100% das sessões que derem erro, só a partir do erro — buffer anterior incluso).
- Privacy: `maskAllInputs: true` (senha + email + qualquer `<input>` ficam mascarados), `blockAllMedia: true` (imagens/vídeo não sobem — zero bandwidth), `maskAllText: false` (texto renderizado permanece pra diagnose de flow — nome produto, preço, estados UI).
- Sem `NEXT_PUBLIC_SENTRY_DSN` setado → integration não roda (guard Sprint 31 preservado). Dev local segue zero-config.

#### Privacy / GDPR (Sprint 59)

Cesta opera na Espanha → GDPR aplica. Session Replay precisa mascarar PII por padrão:

- `maskAllText: true` (secure-by-default) — qualquer texto renderizado no DOM vai como `***` no replay.
- `maskAllInputs: true` — senha, email, qualquer `<input>` sempre mascarados.
- `blockAllMedia: true` — fotos de ticket (OCR) + imagens não sobem.
- `sendDefaultPii: false` em todos os 3 configs frontend + backend `sentry.init.ts` → IPs, cookies e headers sensíveis não vão pro Sentry sem opt-in explícito via `beforeSend`.
- Opt-in granular via atributo HTML:
  - `data-sentry-unmask` em elementos cujo texto é chrome i18n público (bottom-nav labels, nome/preço do produto em catálogo público).
  - `data-sentry-mask` reaplicado em elementos sensíveis mesmo com default secure (defense-in-depth): `/perfil` (nome/email/telefone/data de cadastro), `/minha-cesta/configurar` wizard (composição familiar + restrições alimentares — dados saúde Art. 9 GDPR), `/gastos` dashboard + lista de receipts (valores pessoais), `/minha-lista/[id]` nome da lista + linhas de itens (combinações podem revelar contexto médico).
- Regra permanente (`CLAUDE.md` do projeto): qualquer novo componente que exiba PII do usuário deve ganhar `data-sentry-mask` no commit.

#### Custom spans backend (Sprint 58)

3 pontos de enfileiramento/fetch ficam auto-instrumentados além dos HTTP spans do `@sentry/node`:

- `ocr.enqueue` — `receipts.service.upload` publica job na fila `receipts`.
- `basket.generate.enqueue` / `basket.regenerate.enqueue` — `family-baskets.service` publica na fila `basket-generation`.
- `catalog-sync.<supermarket-slug>` — `catalog-sync.service.runFor` chama `adapter.fetchProducts()` do mercado específico (Mercadona, Carrefour, …).

Sem DSN, `Sentry.startSpan` é no-op — zero overhead.
