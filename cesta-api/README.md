# cesta-api

Backend NestJS para o [Cesta](../README.md) — comparação de preços de supermercados (Comunidade de Madrid).

## Setup

```bash
npm install
npx prisma migrate dev
npm run start:dev          # http://localhost:3001
```

Variáveis de ambiente: ver [`../.env.example`](../.env.example).

## Scripts

| Script | Função |
|---|---|
| `npm run start:dev` | Hot-reload |
| `npm run build` | `nest build` → `dist/` |
| `npm run test` | Jest |
| `npm run test:coverage` | Jest + lcov |
| `npm run audit:dtos` | Verifica DTOs seguem padrão |
| `npm run audit:repos` | Verifica repositórios seguem padrão |
| `npx prisma studio` | DB inspector |

## Documentação

- [`../README.md`](../README.md) — overview, deploy, CI
- [`../CLAUDE.md`](../CLAUDE.md) — contexto do projeto
- [`../SECURITY.md`](../SECURITY.md) — reporting, SLA, GDPR
- [`../claude-geral-consolidado.md`](../claude-geral-consolidado.md) — padrões de dev
