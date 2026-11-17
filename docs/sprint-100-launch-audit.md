# Sprint 100 — Production Readiness Audit

> Executado via skill `vibe-code-launch-check` (checklist pepperworks/vibe-coders-checklist).
> Data: 2026-11-17 · Branch: `feat/sprint-100` · Commit base: `2bae8a2`

## Verdict

**Shippable com 2 gaps críticos sem verificação.** Codebase apresenta higiene alta para projeto em fase pre-1.0: CI/CD, Sentry obs, rate-limit, auth guards, GDPR DSR, error/loading states, cookie consent, i18n, 2FA — todos cobertos. Lacunas em dashboards externos (billing caps, backups testados, SPF/DKIM) e 1 feature não-implementada (password reset).

---

## Legenda

- ✅ **Done** — verificado em código/config.
- ❌ **Missing** — procurado, não encontrado.
- 🟡 **Can't verify** — fora do repo (dashboards, DNS, provedores). Confirmar manualmente.
- ⏭️ **Skipped** — não aplicável.

---

## High risk

| Item | Status | Nota |
|---|---|---|
| Spend caps billing alerts em APIs pagas | 🟡 | Sem APIs pagas no código hoje (Sentry/Resend/Vercel/Render/Neon/Upstash = free). Se adotar LLM/Twilio: setar hard caps. |
| Database backup | 🟡 | Neon free tier faz **branch-based backup**: branches tornam-se restore points. Não há cron de export off-site. Verificar política de retention no dashboard Neon. |
| Restore from backup testado | 🟡 | Nunca executado. Recomenda-se dry-run via Neon branch restore em staging DB. |
| Rollback plan | ✅ | Vercel: instant rollback no dashboard (keep deployment history). Render: `render.yaml` + Blueprint → redeploy commit anterior. |
| Sem secrets commitados | ✅ | `.gitignore` cobre `.env`, `.env.local`, `.env.*.local`. Scan `git log -p -S "Bearer " --since=90d` sem matches em `.env*`. |
| Rotação de keys expostas | ✅ (precaução) | S92 implementou rotation infra (`JWT_*_SECRET_PREVIOUS`). Nenhum incidente conhecido; procedimento pronto. |
| Rate limiting endpoints públicos | ✅ | `@nestjs/throttler` global em `app.module.ts` + `@Throttle` scoped em 10 controllers (auth, users, receipts, family-baskets, admin, health, search-history, telemetry, 2fa, categories). Named throttler fix S98. |
| Auth em todos os endpoints | ✅ | JWT guard global (`@Public()` opt-out). Catálogo público via `@Public()` em `products`/`supermarkets`/`reviews` (S72). |

---

## Testing & deploys

| Item | Status | Nota |
|---|---|---|
| CI/CD | ✅ | `.github/workflows/ci.yml` (lint + test + build api+web) + `keep-alive.yml` (cron 10min anti-coldstart). |
| Unit tests | ✅ | Jest `cesta-api` + Vitest `cesta-web`. Coverage CI com threshold (S43 web + S56 api) + Codecov. |
| Smoke tests | 🟡 | `/health` + `/health/deep` como smoke pós-deploy. Sem E2E Playwright/Cypress integrado — gap aceitável em pre-1.0. |
| Regression tests | 🟡 | Coverage incremental. Sem suite dedicada de regression. |
| Staging ≠ production | ❌ | Preview Vercel por PR (frontend); backend não tem staging separado. Render free não comporta 2 serviços. Risco: schema migration vai direto a prod. |
| Dependency audit | ✅ | `npm audit --audit-level=high` em CI (S79) — build cai em high/critical. |

---

## Monitoring

| Item | Status | Nota |
|---|---|---|
| Alerting | 🟡 | Sentry Issue Alerts default. Sem PagerDuty/Discord/email custom wiring verificado. |
| Error tracking | ✅ | Sentry `AllExceptionsFilter` back + `SentryBoundary` front (S31). Source maps upload CI (S55). |
| Logging | ✅ | Nest logger default + request logger interceptor. Render streams stdout. |
| Performance monitoring | ✅ | Sentry Performance APM (S55) + Web Vitals reporter (S76) + custom spans OCR/basket/catalog-sync (S58). |
| Uptime monitoring | 🟡 | `keep-alive.yml` pinga `/health` a cada 10min — serve como heartbeat passivo. Sem UptimeRobot/BetterStack dedicado. |
| Analytics | ❌ | Sem Vercel Analytics / Plausible / PostHog. Session Replay Sentry (S58) cobre UX, não métricas product. |

---

## Infrastructure

| Item | Status | Nota |
|---|---|---|
| Custom domain + SSL | 🟡 | Live em `cesta-web.vercel.app` + `cesta-gsvc.onrender.com` (SSL automático). Custom domain não configurado — aceitável pre-1.0. |
| Email auth (SPF/DKIM/DMARC) | 🟡 | Resend gere DKIM automático se domínio verificado no painel Resend. Confirmar: `dig TXT <domain>` retorna `_dmarc` + `_domainkey._resend`. |
| Image optimization | ✅ | `next/image` + Vercel Blob (S77) + WebP/AVIF automático. `placeholder.webp` em `/public`. |
| Caching | ✅ | SSR + ISR Next 16 (`cacheComponents` ativo S48), `revalidateTag` após catalog-sync (S47), Redis BullMQ. |

---

## AI-specific

⏭️ **Skipped.** Cesta não faz chamadas a LLMs. OCR via Tesseract.js (local, worker BullMQ) — sem API externa.

---

## Users & legal

| Item | Status | Nota |
|---|---|---|
| Accessibility | 🟡 | ConfirmDialog a11y (S88) + dropdown focus restore (S93) + aria i18n (S84/S86). Sem audit Lighthouse/axe completo documentado. |
| Privacy policy + terms | ✅ | `/politica-privacidade` + cookie-banner referencia `/terminos` e `/politica-privacidade` (S23/S56). |
| Cookie consent | ✅ | `cookie-banner.tsx` (S56) + Sentry gate acoplado ao consent. |
| User deletion + data | ✅ | `DELETE /users/me` soft-delete + hard-delete BullMQ worker 30d grace (S45/S63) + CSV export ZIP (S91). GDPR Art. 17 + 20. |
| Password reset | ❌ | **Gap feature.** Grep: nenhum endpoint `password-reset` / `forgot-password` / `resetPassword`. 2FA TOTP existe (S99), mas usuário sem 2FA que perder senha fica locked. |
| Email verification | ✅ | S75 via Resend. `auth.service.ts` + `email.service.ts` cobertos com specs. |

---

## Polish

| Item | Status | Nota |
|---|---|---|
| 404 / 500 / empty / loading states | ✅ | `not-found.tsx` + `error.tsx` + `loading.tsx` em root + rotas críticas (`/comparar`, `/produto/[pid]`, `/gastos/[id]`, `/minha-lista/[id]`, `/favoritos`). |
| OG images + favicon | ✅ | `og-image.png` + OG per produto via Satori (S88/S89) + `manifest.webmanifest`. Favicon via `app/icon.*` Next convention. |
| SEO (sitemap, robots, structured data) | ✅ | `sitemap.ts` + `robots.ts` + JSON-LD home/PDP (S88). |
| Tested on multiple devices | 🟡 | Mobile-first PWA testado em dev. Sem matriz formal iOS/Android/desktop documentada. |
| Tested on slow networks | 🟡 | Keep-alive mitiga Render coldstart; Web Vitals reporter captura RUM real. Sem Lighthouse throttled 3G documentado. |
| README | ✅ | Refresh S100 — stack atual, badges, roadmap Layer 1-9 completo, deploy section free tier, live URLs. CHANGELOG.md consolidado S1-S99. |

---

## Top 3 pra fechar antes de 1.0

1. **Password reset endpoint.** Usuário que esquecer senha fica preso. Reaproveitar fluxo Resend (`email.service.ts`) + tokens com TTL curto (15min) + rate-limit 3/h/email. Sprint ~1-2 dias.
2. **Staging backend separado.** Pelo menos 1 serviço Render extra ou Fly.io free — proteger prod de schema migration cega. Alt. mais barata: branch Neon dedicada ao PR preview Vercel.
3. **Billing caps + backup restore dry-run.** Sentar no dashboard Neon (snapshot policy + branch restore test), Upstash (daily commands cap), Sentry (event cap), Resend (daily email cap). 30min de trabalho que evita conta surpresa.

---

## Items verificação manual (user, fora do repo)

- [ ] Neon dashboard → confirmar snapshot/PITR retention + fazer 1 restore test
- [ ] Upstash → setar daily command budget
- [ ] Sentry → event cap (free tier sem cap = evento spike derruba quota)
- [ ] Resend → verificar domínio + SPF/DKIM/DMARC válidos
- [ ] Render → cadastrar Discord/email alert em deploy failures
- [ ] Documentar runbook rollback (Vercel + Render + DB migration undo)
