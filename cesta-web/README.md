# cesta-web

Frontend Next.js 15 (PWA) para o [Cesta](../README.md) — comparação de preços de supermercados (Comunidade de Madrid).

## Setup

```bash
npm install
npm run dev                # http://localhost:3000
```

Variáveis de ambiente: ver [`./.env.example`](./.env.example) (ou copiar do `.env.example` da raiz se existir).

> **Nota:** mudanças em `next.config.ts` ou em `src/i18n/messages/*.json` exigem reiniciar o dev server — Turbopack não hot-reload esses arquivos.

## Scripts

| Script | Função |
|---|---|
| `npm run dev` | Hot-reload (Turbopack) |
| `npm run build` | Build de produção |
| `npm run start` | Serve build |
| `npm run lint` | ESLint |
| `npm run test:coverage` | Vitest + v8 |

## Documentação

- [`../README.md`](../README.md) — overview, deploy, CI
- [`../CLAUDE.md`](../CLAUDE.md) — contexto do projeto
- [`../SECURITY.md`](../SECURITY.md) — reporting, SLA, GDPR
- [`../cesta-identidade-visual.md`](../cesta-identidade-visual.md) — design system
