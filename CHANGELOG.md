# Changelog

Consolidado de Sprint 1 → Sprint 99. Formato [Keep a Changelog](https://keepachangelog.com/). Versionamento por sprint (sem SemVer — projeto em fase pre-1.0).

Sprint 100 = marco de release polish: CHANGELOG + README refresh + production-readiness audit.

---

## [Unreleased] — Sprint 100 (MARCO)

- `CHANGELOG.md` consolidando S1–S99 (este arquivo).
- `README.md` refresh: stack atual, badges CI, deploy stack free tier atualizado.
- Audit production readiness via skill `vibe-code-launch-check` — findings críticos reportados em `docs/sprint-100-launch-audit.md`.

---

## Highlights por área (S1–S99)

### Auth & Identity

- **S1 (Layer 2)** — JWT access 15min + refresh 7d, login por email OU telefone.
- **S49** — httpOnly refresh cookie (defense-in-depth vs XSS token theft).
- **S87** — CORS origin aceita team-slug Vercel via regex dinâmica.
- **S92** — JWT secret rotation (`JWT_*_SECRET_PREVIOUS` vars) + admin cancel-delete endpoint. **Breaking**: exige set manual de `JWT_ACCESS_SECRET_PREVIOUS` + `JWT_REFRESH_SECRET_PREVIOUS` em prod ao rotar (ver §Deploy env rotation).
- **S99** — 2FA TOTP (RFC 6238) com recovery codes, QR code no `/perfil`.

### Catálogo & Preços

- **Layer 3 (S2)** — modelos `Supermarket` + `Product` + `ProductPrice` + seed inicial (Google Sheets import).
- **Layer 7 (S6)** — `catalog-sync` + `MercadonaAdapter` (primeiro adapter).
- **S7** — adapters restantes: `Carrefour`, `Alcampo`, `DIA`, `Froiz`, `LIDL`, `Aldi`.
- **S8** — polite-fetch anti-bot: rate limit 1 req/s/adapter, User-Agent identificado, respeita robots.txt.
- **S47** — revalidateTag após `catalog-sync` → PDP + home atualizam sem redeploy.
- **S77/S78** — product image backfill via Vercel Blob + integração PDP + `/comparar` + `/minha-lista`.

### Shopping Experience

- **Layer 4 (S3)** — "Minha Lista" com comparativo real-time entre mercados + lista híbrida.
- **S4** — `/comparar` grid multi-produto.
- **S5** — favoritos + `/favoritos`.
- **S6** — `/perfil` + `users.me`.
- **S9** — ordenação por preço unitário (€/kg, €/L, €/un).
- **S14** — filtro dietary na home + auto-apply via profile.
- **S15** — `/comparar` highlight do melhor nutriente.
- **S17** — autocomplete de busca + debounce + highlight.
- **S51** — Nutri-Score A-E oficial (FSA variants, substitui simplificado da S29).
- **S81** — sync localStorage recent searches → backend no primeiro login.

### Cesta Familiar

- **Layer 6 (S5)** — wizard + BullMQ worker de geração.
- **S45 fase 2** — bidirectional dietary sync user ↔ family-profile.
- **S98** — fase 1 refactor: wizard 5 steps + budget + replace/best-market + rate-limit 1/24h.
- **S98 P0** — fix throttler leak global (named throttler `familyBasket` vazava pra outras rotas).

### Gastos & OCR

- **Layer 8 (S7)** — OCR de notas via Tesseract worker + `price-correction` + dashboard `/gastos`.
- **S97** — gastos OCR Fase 1: rate limit upload + sharp (preprocess) + fuzzy match produtos.

### Alertas & Notificações

- **Layer 9 (S8)** — alertas de preço + push notifications baseline.
- **S96** — push notifications fase 1: Web Push subscription + cron 2h verifica alertas.

### GDPR / Privacy

- **S56** — cookie consent banner + Sentry DSR gate.
- **S57** — DSR endpoints export + delete (GDPR Art. 17 + 20).
- **S58** — Sentry Session Replay com `maskAllInputs` + `blockAllMedia`.
- **S59** — Session Replay secure-by-default: `maskAllText: true`, `sendDefaultPii: false`, `data-sentry-mask` em todo componente que renderiza PII.
- **S63** — soft-delete grace period 30d (BullMQ hard-delete scheduler).
- **S90** — UI reativar conta soft-deleted em grace period.
- **S91** — CSV export ZIP multi-file (GDPR Art. 20) + fix StreamableFile bypass TransformInterceptor.
- **S94** — email cron reminder grace-period (7d + 1d antes do hard-delete).
- **S95** — admin UI cancel soft-delete.

### Observabilidade

- **S31** — Sentry errors (NestJS + Next.js) opt-in via DSN.
- **S55** — Sentry Performance APM + source maps upload CI (`project:releases` token).
- **S58** — custom spans backend: `ocr.enqueue`, `basket.generate.enqueue`, `catalog-sync.<supermarket>`.
- **S76** — performance checklist baseline: Web Vitals reporter + indices DB críticos.
- **S87** — `/health/deep` endpoint (DB + Redis, rate-limit 10/min) + CORS team-slug env.

### Infraestrutura & Deploy

- **S23** — health check + graceful shutdown + Render blueprint (`render.yaml`).
- **S45** — scheduled hard-delete BullMQ worker (GDPR Art. 17).
- **S65** — Sentry release tracking + bundle S50/S54 nits.
- **S71** — cold start resilience Render free tier (warm-up ping).
- **S74** — CORS aceita Vercel preview origins via regex.
- **S75** — email verification via Resend.
- **S79** — security policy (`SECURITY.md`) + npm audit high gate CI.

### i18n

- **S10** — i18n `/login` + `/register` forms.
- **S22** — Accept-Language auto-detect pra logged-out.
- **S30** — structured error codes (`AppException`) + frontend `translateError`.
- **S82** — html lang dynamic via route group locale.
- **S85/S86** — i18n nits: install prompt, compare header, favoritos, neutral tokens.
- **S99 gate 4** — toast i18n + feature detect fallbacks.

### SEO & Metadata

- **S48** — refactor `/produto/[pid]`, `/comparar`, `/minha-lista/[id]`, `/gastos/[id]` como Server Components.
- **S88** — ConfirmDialog a11y + JSON-LD home/PDP + OG image per produto (Satori).
- **S89** — OG image abort timeout + `og:type` doc + `AppException` migration.
- **S93** — `AppException` migration backend + dropdown focus restore.

### Testing & CI

- **S41** — Vitest setup frontend + foundational tests.
- **S43** — coverage v8 + CI threshold web (baseline 6/3/4/6).
- **S56** — coverage jest + CI threshold api (baseline 9/2/4/9) + Codecov badge.
- **S46** — webhook HMAC auth + retry backoff revalidate.

---

## Feature Flags por sprint

| Sprint | Flag / Gate | Status |
|---|---|---|
| S31 | `SENTRY_DSN` (back) / `NEXT_PUBLIC_SENTRY_DSN` (web) | opt-in, SDK no-op sem DSN |
| S55 | `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` | source maps upload CI |
| S58 | `NEXT_PUBLIC_SENTRY_REPLAY_SAMPLE_RATE` (default 0.05) | Session Replay |
| S58 | `NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE` (default 1.0) | Replay on error |
| S75 | `RESEND_API_KEY` + `RESEND_FROM` | email verification + grace-period reminder |
| S87 | `VERCEL_TEAM_SLUG` | CORS regex dinâmica (default `gabriels-projects-f5aa3b24`) |
| S99 | `TWOFA_ISSUER` (default `Cesta`) | 2FA TOTP label no QR code |

---

## Breaking changes

### S87 — CORS team-slug env

Antes: CORS hardcoded aceitava só `cesta.vercel.app` + previews via regex estática.
Depois: `VERCEL_TEAM_SLUG` env var controla o team aceito. Default preserva comportamento pra team `gabriels-projects-f5aa3b24`; qualquer outro team precisa setar.

### S92 — JWT secret rotation

Antes: `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` únicos. Rotate = logout global.
Depois: rotate zero-downtime via `JWT_ACCESS_SECRET_PREVIOUS` + `JWT_REFRESH_SECRET_PREVIOUS`. Tokens assinados com secret antigo validam até expirar.

**Migration path em prod:**

1. Gerar novo secret: `openssl rand -base64 48`
2. No Render dashboard: setar `JWT_ACCESS_SECRET_PREVIOUS = <valor atual de JWT_ACCESS_SECRET>` **antes** de alterar o novo. Idem para refresh.
3. Trocar `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` pros novos valores.
4. Após 7 dias (TTL max do refresh), remover as `_PREVIOUS` vars.

### S98 — Named throttler scope

Antes: `@Throttle({ familyBasket: ... })` em `forRoot` aplicava globalmente.
Depois: named throttler em `forRoot` = template; usar `@Throttle({ default: ... })` inline em cada rota pra scope por-rota (fix P0 S98 → bug em memória `feedback-throttler-named-global`).

---

## Deploy env vars rotation history

| Sprint | Var | Ação |
|---|---|---|
| S23 | `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN` | Created (Render blueprint) |
| S23 | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Created (`generateValue: true`) |
| S31 | `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE` | Added (opt-in Sentry) |
| S55 | `SENTRY_ENV`, `SENTRY_RELEASE` | Added (release tracking) |
| S75 | `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_AUDIENCE_ID` | Added (email verification) |
| S87 | `VERCEL_TEAM_SLUG` | Added (CORS dynamic) |
| S92 | `JWT_ACCESS_SECRET_PREVIOUS`, `JWT_REFRESH_SECRET_PREVIOUS` | Added (rotation support) |
| S99 | `TWOFA_ISSUER` | Added (2FA label) |

---

## Live URLs

- **Web (prod):** https://cesta-web.vercel.app
- **API (prod):** https://cesta-gsvc.onrender.com (`/api/v1`)
- **API health:** https://cesta-gsvc.onrender.com/health · https://cesta-gsvc.onrender.com/health/deep

---

## Links

- Histórico granular (164 commits): `git log --oneline origin/main`
- ADRs: [`docs/adr/`](./docs/adr/)
- Produto: [`cesta.md`](./cesta.md)
- Padrões: [`claude-geral-consolidado.md`](./claude-geral-consolidado.md)
