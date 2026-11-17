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

## JWT secret rotation (Sprint 92)

Assinatura usa sempre `JWT_*_SECRET_CURRENT`. A verificação tenta `_CURRENT` e
cai pro `_PREVIOUS` quando configurado — janela de overlap zero-downtime.

Procedimento (acesso ou refresh; aplica-se igual aos dois):

1. Copie `JWT_ACCESS_SECRET_CURRENT` para `JWT_ACCESS_SECRET_PREVIOUS` (idem
   refresh). No Render: painel do serviço → Environment → edit.
2. Gere novo valor em `JWT_ACCESS_SECRET_CURRENT` (ex: `openssl rand -hex 48`).
3. Deploy. Boot escreve `[audit] SecretRotated kinds=...` no log confirmando
   que `_PREVIOUS` está carregado.
4. Aguarde o TTL do refresh token (`JWT_REFRESH_EXPIRES_IN`, default `7d`).
   Access tokens de 15m e refresh tokens antigos continuam válidos nesse
   intervalo.
5. Após a janela, remova `JWT_ACCESS_SECRET_PREVIOUS` / `JWT_REFRESH_SECRET_PREVIOUS`
   e redeploy. Rotação completa.

Não gire `access` + `refresh` no mesmo deploy; escalone pelo menos um ciclo de
refresh entre eles pra evitar invalidar todas as sessões ativas.

## Documentação

- [`../README.md`](../README.md) — overview, deploy, CI
- [`../CLAUDE.md`](../CLAUDE.md) — contexto do projeto
- [`../SECURITY.md`](../SECURITY.md) — reporting, SLA, GDPR
- [`../claude-geral-consolidado.md`](../claude-geral-consolidado.md) — padrões de dev
