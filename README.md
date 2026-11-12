# Cesta

[![CI](https://github.com/ArtudGabriel/cesta/actions/workflows/ci.yml/badge.svg)](https://github.com/ArtudGabriel/cesta/actions/workflows/ci.yml)

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
