# Cesta

[![CI](https://github.com/ArtudGabriel/cesta/actions/workflows/ci.yml/badge.svg)](https://github.com/ArtudGabriel/cesta/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/ArtudGabriel/cesta/branch/main/graph/badge.svg)](https://codecov.io/gh/ArtudGabriel/cesta)

App mobile-first (PWA) de comparação de preços de supermercados para a Comunidade de Madrid. Catálogo em tempo quase-real, controle de gastos via OCR de notas fiscais, alertas de preço, avaliações de produtos e cesta familiar personalizada.

**Idiomas:** Español · Português (Brasil)

**Live:** [cesta-web.vercel.app](https://cesta-web.vercel.app) · API: [cesta-gsvc.onrender.com](https://cesta-gsvc.onrender.com/health)

---

## Documentação

- [`CHANGELOG.md`](./CHANGELOG.md) — Highlights por sprint (S1–S99), breaking changes, env rotation history
- [`cesta.md`](./cesta.md) — Documento de produto (features, regras, roadmap)
- [`cesta-identidade-visual.md`](./cesta-identidade-visual.md) — Design system
- [`claude-geral-consolidado.md`](./claude-geral-consolidado.md) — Padrões de desenvolvimento
- [`CLAUDE.md`](./CLAUDE.md) — Contexto do projeto para o assistente
- [`SECURITY.md`](./SECURITY.md) — Política de segurança, reporting, SLA, GDPR
- [`docs/adr/`](./docs/adr/) — Architecture Decision Records
- [`docs/sprint-100-launch-audit.md`](./docs/sprint-100-launch-audit.md) — Production readiness audit (Sprint 100)

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

- **Backend:** NestJS 11 + Prisma 5 + PostgreSQL 16 + BullMQ + Redis
- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + shadcn/ui + React Query + Zustand
- **Validação:** class-validator (back) + Zod (front) + OpenAPI-gerado DTOs (shared)
- **Auth:** JWT access 15min + refresh 7d (httpOnly cookie) + 2FA TOTP opcional
- **i18n:** next-intl (ES + PT-BR)
- **Observability:** Sentry (errors + perf + Session Replay) + Web Vitals + custom spans BullMQ/OCR/catalog-sync
- **Containers:** Docker + docker-compose

### Roadmap (Layer 1 → 9 — concluído)

| Layer | Escopo | Status |
|---|---|---|
| 1 | Infra base (scaffold api + web + Docker) | Completo (S0) |
| 2 | Auth (email/telefone + JWT + refresh) | Completo (S1) |
| 3 | `supermarkets` + `products` + `product-prices` + seed | Completo (S2) |
| 4 | `shopping-lists` ("Minha Lista") + comparativo real-time | Completo (S3) |
| 5 | `reviews` | Completo (S4) |
| 6 | `family-profiles` + `family-baskets` + worker BullMQ | Completo (S5, refactor S98) |
| 7 | `catalog-sync` + adapters (Mercadona, Carrefour, Alcampo, DIA, Froiz, LIDL, Aldi) | Completo (S6–S8) |
| 8 | `receipts` + OCR + `price-correction` | Completo (S7, hardening S97) |
| 9 | `alerts` + push notifications | Completo (S8, push fase 1 S96) |

Pós-Layer 9: GDPR DSR (S56–S91), Sentry observability (S31/S55/S58/S59), email verification Resend (S75), product images Vercel Blob (S77–S78), 2FA TOTP (S99).

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

### Coverage policy (Sprint 43 web + Sprint 56 api + Sprint 194 rebase + Codecov)

CI roda tests + coverage gate em dois steps distintos (clareza logs: bug de teste vs regressão coverage):

- `npm run test:ci` — unit tests sem coverage (fail fast).
- `npm run test:coverage:gate` — coverage com threshold enforcement.

Artifacts `coverage-report` + `coverage-api` subidos (retention 7 dias). Codecov upload com flags `web` + `api` (continua graceful sem `CODECOV_TOKEN`).

**Thresholds atuais** (Sprint 194 rebase 2026-11-26, baseline -2pp):

| Métrica | Web threshold | Web baseline | API threshold | API baseline |
|---|---|---|---|---|
| Statements | 33% | 35.28% | 55% | 56.94% |
| Branches | 27% | 29.75% | 46% | 48.32% |
| Functions | 28% | 30.3% | 41% | 42.95% |
| Lines | 33% | 35.81% | 55% | 57.57% |

**Política:** zero regressão. PR cai se coverage despenca abaixo do threshold. Rebase threshold quando baseline subir ≥5pp acima do floor atual (procedure abaixo).

**Regen baseline procedure** (quando threshold ficar defasado):

```bash
# 1. Rodar coverage local para capturar baseline atual:
cd cesta-api && npm run test:coverage        # → "Coverage summary" block
cd cesta-web && npm run test:coverage

# 2. Atualizar thresholds (baseline - 2pp, arredondado p/ baixo):
#    cesta-api/package.json → "jest" > "coverageThreshold" > "global"
#    cesta-web/vitest.config.ts → test.coverage.thresholds

# 3. Documentar nova baseline + rationale aqui + no commit:
#    "chore: rebase coverage threshold (baseline NN.N% → floor NN%)"

# 4. CI re-run deve passar — se não, baseline atual já regressou,
#    não rebase: investigar regressão primeiro.
```

**Local verify antes de PR:**

```bash
cd cesta-api && npm run test:coverage:gate   # roda com threshold
cd cesta-web && npm run test:coverage:gate
# → coverage/index.html (HTML report drill-down por arquivo)
```

Download CI report: GH Actions run → Artifacts → `coverage-report` / `coverage-api`.

---

## Deploy

Stack free-tier combinado:

| Peça | Serviço | Role | Sprint |
|---|---|---|---|
| Web (Next.js) | **Vercel Hobby** | Edge SSR + ISR + preview por PR | Blueprint S23 |
| API (NestJS) | **Render free** | Backend + BullMQ worker | Blueprint S23 |
| Postgres | **Neon free** | Serverless Postgres 3GB, zero spin-down | Setup S23 |
| Redis | **Upstash free** | BullMQ queues + rate-limit | Setup S23 |
| Email | **Resend free** | Verificação de email + grace-period reminders | S75 |
| Blob storage | **Vercel Blob** | Imagens de produto + recibos OCR | S77 |
| Error / APM / Replay | **Sentry free** | Errors + perf + session replay + source maps | S31/S55/S58 |

Sprint 23 preparou tudo — `render.yaml` blueprint + health check + graceful shutdown + env docs.

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
5. Opcional: `VERCEL_TEAM_SLUG` se o time Vercel for diferente do default `gabriels-projects-f5aa3b24` (Sprint 87 — regex dinâmica)
6. Deploy. Primeira build leva ~5min (npm ci + prisma migrate deploy + nest build)
7. Health check em `/health` (shallow — Render polling) + `/health/deep` (DB+Redis, rate limit 10/min) — Sprint 87
8. Copiar URL pública (ex `https://cesta-api.onrender.com`)

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
# -> { "status": "ok", "uptime": ..., "timestamp": "..." }  (shallow liveness)

curl https://cesta-api.onrender.com/health/deep
# -> { "status": "ok", "checks": { "db": {...}, "redis": {...} } }  (deep, 10/min)
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
