# ADR 0021 — OpenAPI/Swagger autogen scope (S204) + defer rollout

- **Date:** 2026-11-26 (S204) · updated 2026-11-26 (S205, S206)
- **Status:** Accepted (S204) · rollout progress tracked here (S205+)

## Progress tracker

| Sprint | Controllers newly covered | Running total |
|:---:|:---|:---:|
| S204 | `auth`, `products`, `supermarkets`, `health` (pre-existente + revisado) | 4 / 17 |
| S205 | `reviews`, `favorites`, `shopping-lists` (@ApiResponse + response DTOs linked) | 7 / 17 |
| S206 | `alerts`, `receipts`, `expenses` (@ApiResponse + response DTOs linked; expenses DTOs novos) | **10 / 17** |
| S207 | `catalog-sync`, `family-baskets` (planejado) | 12 / 17 |
| S208 | `imports`, `admin`, `two-factor`, `family-profiles`, `notifications` | 17 / 17 |
- **Related:** `cesta-api/src/swagger/swagger.setup.ts`, `src/main.ts`, S201+ (E2E route interception mocks drift risk).

## Context

Cesta frontend E2E (S201 auth, S202 favoritos+comparar, S203 gastos+lista+alertas) usa Playwright route interception para mock de backend shapes. Risco documentado: **mocks podem derivar do contrato real** sem sinal CI (ver README "S201 trade-off + follow-up OpenAPI contract check CI").

OpenAPI/Swagger autogen do backend NestJS resolve dois problemas:

1. **Documentation surface** — devs novos (Dev, Reviewer, QA, Boss) leem OpenAPI vs grep em controllers + DTOs espalhados.
2. **Contract source** — frontend pode importar schema (via `openapi-typescript` S20X) pra gerar types TS + validar mocks E2E contra schema real. Fecha gap S201.

Deps `@nestjs/swagger` já estavam instaladas (pre-sprint). S204 promove de "wiring parcial sem rota" pra "produto consumível /api/docs env-gated".

## Decision

**S204 escopo mínimo + progressive rollout:**

- **G1 infra** — `src/swagger/swagger.setup.ts` extraído de main.ts; DocumentBuilder config (title, version 0.2.0, servers, tags, bearer auth); mount `/api/docs` (prefix global `api/v1` não aplica a Swagger routes).
- **G2 priority decorators** — controllers já decorados pré-S204 (preservados + revisados):
  - `auth` — 10 decorators
  - `products` — 8 decorators
  - `supermarkets` — 3 decorators
  - `health` — 4 decorators
- **G3 env gate** — `isSwaggerEnabled(env)`:
  - `SWAGGER_ENABLED=true` → force enabled (prod opt-in).
  - `SWAGGER_ENABLED=false` → force disabled (dev opt-out).
  - Default: `NODE_ENV=production` → disabled; outros → enabled.
- **G4 smoke** — `swagger.setup.spec.ts` (unit, isSwaggerEnabled) + `swagger.smoke.spec.ts` (integration, GET /api/docs + /api/docs-json). Ambos em `src/` → rodam no `test:ci` + coverage gate S194 holds.
- **G5 docs** — README API section link + este ADR.

### Priority rationale (auth + products + supermarkets + health)

- **auth**: surface mais exposta, crítica pra security review (JWT + refresh cookie + 2FA + DSR).
- **products / supermarkets**: catálogo público — zero auth, mais chamadas, fonte principal de dados pro frontend.
- **health**: readiness/liveness probe surface — prod ops + Render blueprint depende.

## Defer S205+

Controllers abaixo mantêm wiring parcial pré-S204 (@ApiTags/@ApiOperation em alguns handlers) mas NÃO são P0 pra S204 scope:

| Controller | S deferral candidate | Status | Justificativa |
|---|:---:|:---:|:---|
| `favorites` | S205 | ✅ DONE | Shape simples (S205) — @ApiResponse + response DTOs |
| `shopping-lists` | S205 | ✅ DONE | Shape médio + totals endpoint (S205) |
| `reviews` | S205 | ✅ DONE | Shape médio, realocado de S208 → S205 (S205) |
| `alerts` | S206 | ✅ DONE | Rules combo/trend/bundle (S206) — @ApiResponse + AlertResponseDto/AlertRuleResponseDto linked |
| `receipts` | S206 | ✅ DONE | FormData upload + 202 async jobId (S206) — @ApiAcceptedResponse + ReceiptResponseDto linked |
| `expenses` | S206 | ✅ DONE | Agregados summary/by-category/by-supermarket/top-products (S206) — Expense*Dto novos |
| `family-baskets` | S207 | Wizard + regenerate flow — doc exige exemplo request/response |
| `catalog-sync` | S207 | Admin-only, surface interno |
| `imports` | S208 | CSV import GDPR Art. 20 — surface baixa frequência |
| `admin` | S208 | Admin-only metrics |
| `two-factor` | S208 | Auth sub-surface |
| `family-profiles` | S208 | Wizard upstream |
| `reviews` | S208 | Sprint 23 feature, simples |
| `notifications` | S208 | Push subscriptions — surface pequena |

**Policy:** cada sprint S205+ pode cobrir 1-2 controllers com @ApiTags + @ApiOperation + @ApiResponse (success + error shapes) + exemplos. Não bloqueia feature sprints — opcional add-on per PR.

## Alternatives considered

**A) Decorator sweep completo em um único sprint S204:**
- Pros: unificação rápida.
- Cons: estimativa ~400 decorators cross-controller, risco alto de PR gigante + revisão difícil + merge conflicts com feature sprints paralelos.
- **Rejeitado** por escopo.

**B) Skip Swagger — doc API via Markdown manual:**
- Pros: zero deps + zero autogen complexity.
- Cons: drift inevitável, zero contract check pra frontend E2E, re-work manual every sprint.
- **Rejeitado** — drift é o problema que motivou S204.

**C) Terceiro ferramenta (Redoc, Scalar, Swagger gratuito custom):**
- Pros: UI mais polida.
- Cons: `@nestjs/swagger` já integrado com Nest decorators + routing + é o default do framework; mudar significa reinventar roda.
- **Rejeitado** — Swagger UI padrão é suficiente pra MVP.

## Consequences

**Positivas:**
- `/api/docs` dev surface + opt-in prod (via `SWAGGER_ENABLED=true` env em Render dashboard quando prod voltar).
- `/api/docs-json` serve OpenAPI 3 spec JSON — base pra `openapi-typescript` S20X (contract check CI).
- Env gate NÃO precisa `app.use()` conditional — SwaggerModule.setup não registra routes se chamado após `return false`. Zero impacto perf prod default.

**Negativas:**
- Decorator coverage parcial — endpoints sem @ApiOperation renderizam no Swagger UI com título nulo/trimmed. Mitigation: ADR table documenta scope; devs sabem que P2 controllers não são fonte autoritativa em S204.
- Extra ~18s em CI test suite (smoke test). Aceitável — single unit + single integration spec.

**Neutras:**
- Breaking change de path `/docs` → `/api/docs`: path antigo não estava documentado em README (S203 link era placeholder). Zero impact — ninguém tinha bookmark.

## Follow-up

- ~~**S205**: alerts + favorites decoration sweep.~~ → **ENTREGUE S205** (reviews + favorites + shopping-lists; alerts moved to S206).
- ~~**S206**: alerts + receipts (multipart FormData body + jobId examples).~~ → **ENTREGUE S206** (alerts + receipts + expenses; expenses realocado de S207 pra manter progresso 7→10).
- **S207**: catalog-sync + family-baskets.
- **S208**: imports + admin + two-factor + family-profiles + notifications (finisher).
- **S20X (parallel)**: `openapi-typescript` CI gate contra `/api/docs-json` — gera types TS + valida mocks E2E vs schema real (fecha trade-off S201).
- **Prod unblock (post-Render billing resolve)**: setar `SWAGGER_ENABLED=true` em Render env se time quiser docs públicas, OR manter disabled + usar `/api/docs-json` download local via staging.
