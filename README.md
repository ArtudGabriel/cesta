# Cesta

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
