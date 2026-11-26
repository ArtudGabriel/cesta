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

### Dependency security audit (Sprint 79 + Sprint 195 sweep)

CI gate ativo em prod deps (`npm audit --omit=dev --audit-level=high`) nos dois jobs API + Web. Advisory allowlist pra `picomatch` ReDoS (GHSA-fc5q-39xc-vjpf) build-time only (filter inline no workflow Web).

**Schedule periódico** (sweep completo):
- Toda `main` merge dispara CI audit (automático — bloqueia PR se HIGH+).
- **Sprint sweep manual: a cada 4-6 sprints OR sempre que Dependabot alertar.**
- Ad-hoc: antes de prod deploy major ou quando CVSS >= 7.0 reportada.

**Sweep procedure** (manual, template:):

```bash
# 1. Audit por projeto (todos levels):
cd cesta-api && npm audit --json > /tmp/audit-api.json
cd cesta-web && npm audit --json > /tmp/audit-web.json
cd ops && npm audit --json > /tmp/audit-ops.json

# 2. Capture HIGH+ / moderate counts no PR body:
node -e "const j=require('/tmp/audit-api.json');console.log(j.metadata.vulnerabilities)"

# 3. npm audit fix (semver-safe only):
cd cesta-api && npm audit fix
cd cesta-web && npm audit fix

# 4. Verify lock diff sensato — rejeitar se bump unexpected em dep direta
#    sem justify (ex: patch em transitive OK; major em dep direta deferred).
git diff --stat cesta-api/package-lock.json cesta-web/package-lock.json

# 5. Re-run audit pra confirmar count baixou:
cd cesta-api && npm audit --json | node -e "..."

# 6. Majors restantes NÃO auto-fix. Abrir GH issue "Defer <pkg> major
#    bump (S<NN>)" com CHANGELOG link + impact assessment.

# 7. Regression gate obrigatório:
cd cesta-api && npm run test:coverage:gate
cd cesta-web && npm run test:coverage:gate
```

**Policy**:
- `npm audit fix --force` **PROIBIDO** sem Dev review. Major bumps são sempre manual review + GH issue tracking.
- Moderate devDeps aceitos defer temporário até sprint sweep próximo (CI filter `--audit-level=high` cobre prod).
- HIGH/CRITICAL em `--omit=dev` é blocker — sprint hotfix imediato.

### Bundle size gate (Sprint 199, ADR 0019)

Post-build script `cesta-web/scripts/bundle-size.mjs` lê `.next/app-build-manifest.json`, computa gzipped size per chunk, agrega por route (firstLoad = total, pageOnly = exclusive, shared = chunks em ≥50% das routes).

**Threshold:**
- First Load JS ≤ 200KB gzip (Lighthouse baseline mobile 4G).
- Per-page JS ≤ 50KB gzip (isola custo rota nova de shared bundle).

**CI (continue-on-error em S199 baseline cycle):**
- Workflow web job pós `npm run build` → `npm run bundle:size`.
- Artifact `bundle-size` (14d retention) com report JSON.
- **S200+ flip pra gate real** após primeira run capturar baseline (ADR 0019 §Follow-up).

**Local verify:**

```bash
cd cesta-web && npm run build && npm run bundle:size
# prints markdown table + writes bundle-size-report.json
```

**JSON-only output:**

```bash
npm run bundle:size -- --json | jq '.routes[] | select(.violations | length > 0)'
```

### Playwright E2E (Sprint 198 + Sprint 201 + Sprint 202 + Sprint 203)

Infra setup inicial pra E2E — chromium headless + Playwright test runner. CI roda em workflow separado (`.github/workflows/e2e.yml`) via schedule noturno + `workflow_dispatch` manual pra não adicionar ~5min no PR CI principal.

**Shared helpers** (`tests/e2e/helpers/auth.ts`, S202+S203): `seedAuth` (auto-dismisses cookie banner), `mockMeEndpoints`, `baseUser`, `envelope`, `fulfillJson`, `dismissCookieBanner` — reusados cross-spec.

**Playwright config** (S202 AJUSTE Boss): `workers: 1` + `fullyParallel: false` — E2E não são hermeticamente isolados (next-server único + mocks state compartilhado). Determinismo > latência pra MVP; sharding por browser context em S20X.

**Smoke** (`tests/e2e/home.spec.ts`, S198): home carrega + search combobox + type `'leche'` + dropdown abre (aria-expanded=true). Assertions mínimas pra não depender de backend (smoke confirma wiring Next + Playwright, não suggestions content).

**Favoritos flows** (`tests/e2e/favoritos.spec.ts`, S202):

| Flow | Cobertura |
|---|---|
| (a) logged navega /favoritos | mock GET `/favorites` → empty state "Aún no tienes favoritos" + heading "Mis favoritos" |
| (b) adicionar favorito reflete lista | mock POST `/favorites` + re-GET; triggera via browser fetch (simula FavoriteToggle PDP); /favoritos refetch mostra 1 item |
| (c) unfavorite optimistic | mock DELETE `/favorites/:id`; Heart → ConfirmDialog (S88) → card some em <2s (useRemoveFavorite onMutate) |
| (d) GDPR mask data-sentry-mask | `[data-testid="favorites-list"]` tem attr `data-sentry-mask` (regra S59) |

**Comparar flows** (`tests/e2e/comparar.spec.ts`, S202):

| Flow | Cobertura |
|---|---|
| (a) empty state sem products | `[data-testid="comparison-empty-state"]` + CTA "Explorar productos" `href="/"` |
| (b) ?products=id1,id2 matrix | SSR degrade [] (S202 resilience) + client /products/compare mock → Tabla radio → matrix visible |
| (c) view toggle Precios ↔ Nutrición | radiogroup `aria-checked` flip |
| (d) winner highlight cheapest | matrix cell `data-cheapest="true"` no preço mais barato por produto |

**S202 app-code resilience patch** — `comparar/page.tsx` + `compare-client.tsx`:
- SSR `fetchCompareSSR` wrap em try/catch: falha API offline NÃO propaga erro → degrada initialData=[]
- CompareClient omite initialData quando vazio pra useCompare refetcha client-side (evita staleTime 5min suprimindo recovery)
- Benefício prod: backend slow/down durante SSR renderiza loader em vez de error boundary; client query retry resgata quando API volta
- Benefício e2e: SSR fetch ECONNREFUSED não bloqueia test runs sem API

**Auth flows** (`tests/e2e/auth.spec.ts`, S201):

| Flow | Cobertura |
|---|---|
| (a) register valid submit | Form preenche + POST `/auth/register` mock → redirect `/` + access token persist |
| (b) logout + guard redirect | POST `/auth/logout` mock + session clear + `/favoritos` guard redireciona `/login?returnUrl=/favoritos` |
| (c) login + reload persist | POST `/auth/login` mock + page reload + session sobrevive (zustand persist + localStorage access token) |
| (d) i18n toggle não invalida session | PATCH `/users/me` mock + toggle PT-BR em `/perfil` + `window.location.reload()` (S169 fix pra regressão S168 P1) — URL continua `/perfil`, user intacto |

**Fixtures strategy — route interception (não docker-compose):**

- Testes usam `page.route("**/auth/*")` + `route.fulfill` para mockar auth endpoints (`/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`) + `/users/me` (profile GET + PATCH).
- Shapes seguem `cesta-web/src/features/auth/types/auth.types.ts` + `cesta-web/src/features/profile` — mocks carregam contrato suficiente pra exercer o frontend sem rodar `cesta-api`.
- **Justificativa (não docker-compose):** (1) determinístico em CI, zero DB state leak entre runs; (2) tempo de run ~5s por spec vs ~2-3min pra spin-up Postgres+Redis+API+migrate+seed; (3) workflow `e2e.yml` já não roda API — mocks alinham com infra existente; (4) contrato backend já é coberto por `cesta-api` jest suite (coverage gate 55%). E2E aqui testa **frontend behavior** (redirects, form validation, session persist, i18n side-effects), não happy path do backend.
- **Trade-off:** mocks podem derivar do contrato real se backend mudar sem atualizar os shapes aqui. Mitigação: shapes tipados via `@ts-expect-error`-able types + jest unit tests em `features/auth/services/*.test.ts` validam serializer + ApiError normalization. S20X: adicionar OpenAPI contract check CI step que valida mocks vs schema.

**Local run:**

```bash
cd cesta-web
npm run e2e:install            # primeira vez — baixa chromium (~170MB)
npm run build && npx next start &
npm run e2e                    # roda specs
npm run e2e:report             # abre HTML report (último run)
npm run e2e:ui                 # Playwright UI mode (debug interactive)
```

**Env override pra apontar prod/preview:**

```bash
PLAYWRIGHT_BASE_URL=https://cesta-web.vercel.app npm run e2e
```

**CI (nightly 06:00 UTC + manual):**
- Workflow `.github/workflows/e2e.yml`.
- Chromium cache por `package-lock.json` hash (invalida em bump `@playwright/test`).
- Artifacts: `playwright-report` (14d) + `playwright-trace` on-failure (7d).
- Manual: Actions tab → E2E → Run workflow → pode passar `base_url` pra prod.

**Gastos flows** (`tests/e2e/gastos.spec.ts`, S203):

| Flow | Cobertura |
|---|---|
| (a) empty state + CTA scan | `/gastos` mock GET `/receipts`=[] → "Aún no tienes tickets" + ScanButton visible |
| (b) upload nota → 202 jobId | `setInputFiles` TINY_JPEG → preview visible → submit → POST /receipts mock 202 `{jobId, receiptId}` → router.push `/gastos/:receiptId` + response status assertion |

**Minha-lista flows** (`tests/e2e/minha-lista.spec.ts`, S203):

| Flow | Cobertura |
|---|---|
| (a) empty + CTA criar | "Aún no tienes listas" + "Crear nueva lista" button |
| (b) criar lista + redirect | Click CTA + input "Lista Semanal" + Crear → POST /shopping-lists mock → URL `/minha-lista/:id` |
| (c) totals por mercado | Lista com `cheapestTotal: 24.50` renderiza preço + "desde" no card top-level |

**Alertas flows** (`tests/e2e/alertas.spec.ts`, S203):

| Flow | Cobertura |
|---|---|
| (a) /alertas empty state | GET /alerts + /alerts/rules mock → heading "Mis alertas" visible |
| (b) /alertas/novo wizard 3 opts | `rule-wizard-type-picker` + `rule-type-combo/trend/bundle` todos visíveis + click combo → `rule-wizard-form` monta |

**S203 gating conhecido (SSR dependente):**
- Detail pages (`/gastos/[id]`, `/minha-lista/[id]`, `/produto/[pid]`) usam SSR fetch sem resilience patch (como comparar S202). Backend offline → notFound() OR error boundary. E2E flows cobrem até redirect URL; conteúdo detail post-redirect out of scope.
- "Add produto" (parte DoD b minha-lista) requer detail page SSR → SKIPPED, follow-up S204+.

**S204+ roadmap:**
- SSR resilience patch cross-page: aplicar comparar/page.tsx pattern (try/catch + Sentry.captureException) em `gastos/[id]`, `minha-lista/[id]`, `produto/[pid]` server components.
- Fuzzy suggest com backend live (requer prod restored).
- /gastos receipt detail OCR edit flow (depois SSR resilience).
- /minha-lista add produto + compare totals cross-market (depois SSR resilience).
- /alertas wizard full flow (fill + submit + redirect /alertas).
- OpenAPI contract check CI (valida mocks vs schema; fecha trade-off S201 route interception).
- A11y assertions via `@axe-core/playwright` (replace jsdom-based S197 pra paint rules).

### Accessibility audit (Sprint 197)

`cesta-web/scripts/a11y-audit.mjs` auditia 6 rotas principais (/, /produto/[pid], /comparar, /favoritos, /login, /perfil) via axe-core + jsdom contra HTML SSR de `next start`. CI job Web roda como step pós-build com continue-on-error em primeiro ciclo (baseline-gathering).

**Threshold:** `0 critical + ≤5 serious`. Moderate/minor sem gate (visíveis no report; incentive fix mas não bloqueia).

**Scope limitation (jsdom):** rules dependentes de paint (`color-contrast`, viewport queries) **não rodam** — false positives em jsdom. Real browser testing deferred pós-MVP (Playwright sprint dedicado).

**Local verify:**

```bash
cd cesta-web && npm run a11y:audit         # full flow (build + start + audit)
# OR com build cache existente:
cd cesta-web && npm run a11y:audit:ci      # skip build, assume .next pronto
```

Output: `a11y-audit-report.json` no cwd + stdout per-route counts.

**Regen baseline procedure** (quando tightening threshold):

```bash
# 1. Rodar audit local com Next backend offline (mesmo env CI):
cd cesta-web && npm run build && npm run a11y:audit:ci

# 2. Parse JSON report:
jq '.totals' a11y-audit-report.json
# {"critical":0,"serious":3,"moderate":12,"minor":8}

# 3. Update DEFAULT_THRESHOLD em scripts/a11y-audit.mjs
#    baseline - margem razoável (ex: serious=3 observado → max=5).

# 4. Flip continue-on-error: false no CI step (gate real).

# 5. Document mudança em CHANGELOG + ADR se threshold change
#    muda policy (ex: critical=1 permitido temp vs always-0).
```

**Policy:**
- Feature nova que adicione rota pública = adicionar ao ROUTES em a11y-audit.mjs.
- 0 critical é hard limit — nunca relaxar.
- Serious gate relaxável durante feature sprint, mas tightening sprint obrigatório a cada 10 sprints.
- Report artifact CI retention 14d pra trend tracking.

### i18n parity enforcement (Sprint 196)

`cesta-web` suporta `es` (default) + `pt-BR`. Messages em `cesta-web/src/i18n/messages/{es,pt-BR}.json`. CI job Web roda `npm run i18n:parity` como gate obrigatório — falha se qualquer drift entre as locales.

**Verificações:**
- Keys presentes só em uma locale (onlyEs / onlyPt).
- Type mismatch (ex: path é leaf em ES, branch em PT-BR).
- TODO markers em values (warn-level; não bloqueia gate mas visível no log).

**Local verify antes de PR:**

```bash
cd cesta-web && npm run i18n:parity
# ✅ parity OK (N leaves aligned)
# OR
# ❌ N parity violation(s) — fix translations.
```

**Regen manual procedure** (quando adicionar feature com strings novas):

```bash
# 1. Add key em es.json (default locale — strings canônicas).
# 2. Add mesma key em pt-BR.json com tradução, OR placeholder:
#    "feature.new": "TODO: traducir após review"
# 3. Rodar gate pra confirmar paridade estrutural:
cd cesta-web && npm run i18n:parity
# 4. TODO markers restantes aparecem como [WARN] no log; sprint
#    follow-up elimina antes de MVP launch.
```

**Policy:**
- Adicionar feature nova = adicionar key EM AMBAS locales no mesmo PR.
- Zero drift aceito merge main. CI gate bloqueia.
- `TODO:` prefix permitido temporário em pt-BR quando string ambígua culturalmente; rastreado via log WARN + sprint follow-up pra traduzir.

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
