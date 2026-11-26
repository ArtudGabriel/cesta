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

## Types adoption policy (ADR 0022 + 0023 + 0024)

Consumers (services, hooks, E2E mocks) consomem types gerados via barrel
`src/types/api.ts`:

```ts
import type { Schemas, Operations } from "@/types/api";

type CreateAlertPayload = Schemas["CreateAlertDto"];
type AlertResponse = Schemas["AlertResponseDto"];
type ProductQuery = Operations["ProductsController_findMany"]["parameters"]["query"];
```

### Política por categoria de payload

| Categoria | Política atual |
|---|---|
| Request body (POST/PATCH/PUT) | **Adotar** `Schemas["XxxDto"]` (S210 ADR 0023) |
| Query params | **Adotar** `Operations["XxxController_*"]["parameters"]["query"]` (S210) |
| Response DTO coberto pelo baseline | **Adotar** `Schemas["XxxResponseDto"]` (S212, pós-S211 ADR 0024) |
| Response com leak (`Record<string, never>`, enum perdido, polimórfico) | **Handcrafted business-logic** com justificativa no comentário do `*.types.ts` |

Após S211 (ADR 0024) o backend passou a anotar `@ApiProperty({ type: X, nullable: true })`
canonicamente — baseline response schemas são usáveis em substitutos de types
handcrafted. S212 migrou response types em `auth/catalog/products/shopping-lists/
alerts` + hooks + E2E assertions (fecha o ciclo openapi-typescript S204-S212).

### Replace in place (non-negotiable)

- Zero types `_v2`, zero fallback paralelo, zero `as any`, zero `as unknown`.
- Handcrafted response types permanecem **só** quando o baseline sofre leak
  real (campo polimórfico sem `oneOf`, enum perdido no `@ApiProperty`) — cada
  preservação documentada no header do `*.types.ts` com motivo específico.
- Alvo de follow-up: `AlertResponseDto.type` (enum perdido), `AlertRuleResponseDto.rules`
  (polimórfico sem `oneOf`), `ListTotalsDto.bySupermarket` (leak).

### Auditoria de consumers

`scripts/audit-response-usage.mjs` rastreia consumers de response types no
frontend (fetch/axios envelope, hook generic, service return type, E2E
`toMatchObject`) e sugere qual schema baseline substitui cada tipo handcrafted:

```bash
node scripts/audit-response-usage.mjs            # markdown report
node scripts/audit-response-usage.mjs --count    # contagem total
node scripts/audit-response-usage.mjs --json     # machine-readable
```

Spec do helper `suggestSchemaFrom` em `scripts/audit-response-usage.spec.mjs`
(roda no `vitest run`).

### E2E typed assertions

E2E mocks referenciam feature types + payloads tipados ao invés de inline shapes:

```ts
import type { Schemas } from "@/types/api";

const payload = (await route.request().postDataJSON()) as Schemas["LoginDto"];
const expected: Partial<Schemas["LoginDto"]> = { email, password };
expect(payload).toMatchObject(expected);
```

Fixture `baseUser()` em `tests/e2e/helpers/auth.ts` reflete `Schemas["UserResponseDto"]`
(todos 16 campos). Novos consumers em `tests/e2e/*.spec.ts` seguem o mesmo pattern.

## Documentação

- [`../README.md`](../README.md) — overview, deploy, CI
- [`../CLAUDE.md`](../CLAUDE.md) — contexto do projeto
- [`../SECURITY.md`](../SECURITY.md) — reporting, SLA, GDPR
- [`../cesta-identidade-visual.md`](../cesta-identidade-visual.md) — design system
