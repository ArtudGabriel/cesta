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
| `npm run types:api` | Regera `src/types/generated/api.baseline.d.ts` do spec OpenAPI do `cesta-api` (ADR 0022). |
| `npm run types:api:check` | Gate CI: falha se o baseline committed divergir do spec live (ADR 0022). |

## OpenAPI → client types (ADR 0022)

O `cesta-api` expõe o spec OpenAPI em `/api/docs-json` (gerado por `@nestjs/swagger`,
ver [ADR 0021](../docs/adr/0021-openapi-swagger-scope.md)). O baseline TypeScript
derivado desse spec vive em `src/types/generated/api.baseline.d.ts` (committed).

**Regenerar baseline após mudança de API:**

```bash
npm run types:api        # dumpa spec + roda openapi-typescript + sobrescreve baseline
git diff src/types/generated/api.baseline.d.ts   # inspeciona delta
git add src/types/generated/api.baseline.d.ts
```

**CI drift gate:** `npm run types:api:check` (rodado no job `api` do CI). Se o
baseline divergiu do spec live sem commit correspondente, CI falha com um diff
compacto. Se a mudança for breaking (rename, type change, path removal),
atualize [ADR 0022](../docs/adr/0022-openapi-typescript-ci-gate.md) com a razão
e inclua uma nota no corpo do PR.

Dependências: cesta-api precisa estar em estado buildable (ts-node bootstrap sem
HTTP listen). Script força defaults seguros de env (`DATABASE_URL`, `R2_*`,
`TWO_FACTOR_ENC_KEY`, `JWT_*_SECRET_CURRENT`) via `CESTA_OPENAPI_DUMP=1` sem
precisar de `.env` local nem DB rodando.

## Types adoption policy (ADR 0023)

Consumers (services, hooks, E2E mocks) consomem types gerados via barrel
`src/types/api.ts`:

```ts
import type { Schemas, Operations } from "@/types/api";

type CreateAlertPayload = Schemas["CreateAlertDto"];
type ProductQuery = Operations["ProductsController_findMany"]["parameters"]["query"];
```

Política por categoria de payload:

| Categoria | Política |
|---|---|
| Request body (POST/PATCH/PUT) | **Adotar** `Schemas["XxxDto"]` |
| Query params | **Adotar** `Operations["XxxController_*"]["parameters"]["query"]` |
| Response com nullable fields | **Handcrafted FROZEN** até backend fixar `@ApiProperty({ type, nullable })` (ver ADR 0023) |
| Response sem nullable fields | **Adotar** `Schemas["XxxResponseDto"]` |

**Replace in place** — zero types `_v2`, zero fallback paralelo. Handcrafted
response types ficam em `features/*/types/*.types.ts` até backend fix no S211+.

E2E mocks referenciam feature types diretamente (ex: `import type { Favorite }
from "@/features/favorites/types/favorite.types"`) — proibido duplicar shape
inline em `tests/e2e/*.spec.ts`.

## Documentação

- [`../README.md`](../README.md) — overview, deploy, CI
- [`../CLAUDE.md`](../CLAUDE.md) — contexto do projeto
- [`../SECURITY.md`](../SECURITY.md) — reporting, SLA, GDPR
- [`../cesta-identidade-visual.md`](../cesta-identidade-visual.md) — design system
