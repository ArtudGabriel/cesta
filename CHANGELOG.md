# Changelog

Consolidado de Sprint 1 → Sprint 199. Formato [Keep a Changelog](https://keepachangelog.com/). Versionamento por sprint (sem SemVer — projeto em fase pre-1.0).

Sprint 100 = primeiro marco (release polish S1–S99). Sprint 200 = segundo marco (S101–S199 backfill + MARCO audit snapshot).

---

## [Unreleased] — Sprint 200 (MARCO)

Consolidação cem-sprint-marcadas S101→S199. Prod ainda **SUSPENDED** (Render billing 2026-11-26) — este marco é code-only.

**Deliverables:**

- `scripts/changelog-backfill.mjs` — helper reproduzível (`git log` → tabela sprint × SHA × PR).
- Backfill S101–S199 (tabela abaixo) — gerada com `node scripts/changelog-backfill.mjs --from 101 --to 199`, cada entry tem SHA verificável via `git show <sha>` (regra `feedback-changelog-anti-hallucination`).
- `docs/audit-s200.md` — snapshot MARCO dos gates locais: coverage (api+web), i18n parity, a11y audit, bundle size.
- `docs/adr/0020-sprint-200-marco.md` — consolidate learnings (sprints shipped, patterns recorrentes, deferred bugs).
- Zero prod touch (MVP stack free tier memory `project-mvp-stack-zero-cost`; Render suspenso memory `project-render-suspended-billing-2026-11`).

**Temas dominantes S101–S199 (ver ADR 0020 pra narrativa completa):**

- **Bloco 1 MVP — Mercadona bootstrap** (S108–S116): script bootstrap, AUTO_SYNC_ON_BOOT, BullMQ jobId sanitization, auto-create Product, Upstash rediss TLS, timeout guard.
- **Bloco 2 MVP — multi-adapter** (S119–S127): Carrefour anti-bot, DIA, Eroski scraping, LIDL, Aldi; CDN bare fetch pattern descoberto.
- **Bloco 2.5 — anti-bot escalation + rollback** (S128–S135): Puppeteer tentativa, OOM Render, ScrapingBee resgate, Vercel Blob → Cloudflare R2.
- **Bloco 3 MVP — UX polish** (S131–S132, S147–S176): comparar matriz, featured deals, advanced filters (3× iterações + rollback S151), skeletons, polish por rota (/alertas, /gastos, /favoritos, /minha-cesta, PDP).
- **Observability + hardening** (S177–S199): CJS imports audit, Prisma/Neon deploy resilience, Render blueprint sync, fuzzy pg_trgm, smoke expand, retry util, BullMQ worker obs, Sentry breadcrumbs, coverage/i18n/a11y/bundle CI gates.
- **ADRs novos** (12): 0009–0020 (anti-bot, R2, CJS, fuzzy, Prisma/Neon, blueprint, LIDL yield, prod restoration, catch audit, bundle size, S200 marco).

**Backfill table (115 commits, S101–S199):**

<!-- regen: node scripts/changelog-backfill.mjs --from 101 --to 199 -->

| Sprint | SHA | PR | Subject |
|---:|:---|:---:|:---|
| S101 | `fc87b37` | #45 | feat(api,web): sprint 101 — post-OCR expense edit UI (#45) |
| S102 | `424daf9` | #46 | feat(api,web): sprint 102 — CSV import GDPR Art. 20 symmetric (#46) |
| S103 | `fca82ca` | #47 | feat(web): sprint 103 — hygiene batch P3 (translateError resilience + brand token fallbacks) (#47) |
| S104 | `4f732bb` | #48 | feat(api,web): sprint 104 — admin audit log viewer (#48) |
| S105 | `ecbd245` | #49 | feat(api,web): sprint 105 — alert rules combo/trend/bundle (#49) |
| S105 | `c5a7580` | #50 | fix(api,web): sprint 105 — gate 3 ajustes (coverage + ADR) (#50) |
| S105 | `7d7f4ba` | #51 | feat(web): sprint 105 — gate 4 nits (CTA + rules list + metadata) (#51) |
| S106 | `d3b52f3` | #52 | feat(api,web): sprint 106 — ProductPicker + /products/search endpoint (#52) |
| S106 | `9b0a955` | #53 | fix(api): sprint 106 — oversample em findForSearch pra top-N global (#53) |
| S106 | `4db0d79` | #54 | fix(api,web): sprint 106 — throttler cascade + i18n label stale (#54) |
| S107 | `7656848` | #55 | feat(api,web): sprint 107 — admin metrics dashboard (#55) |
| S108 | `94b5b69` | #56 | feat(api): sprint 108 — MVP bloco 1 mercadona bootstrap script + spec (#56) |
| S109 | `e55d903` | #57 | feat(api): sprint 109 — AUTO_SYNC_ON_BOOT enqueue mercadona bootstrap (#57) |
| S109 | `9a3b6da` | #58 | fix(api): sprint 109 — detach bootstrap-sync enqueue de app.listen() (#58) |
| S110 | `90aa4fd` | #59 | feat(api): sprint 110 — AUTO_SYNC_ON_BOOT enqueue pós listen() com waitUntilReady (#59) |
| S111 | `d2d728b` | #60 | feat(api): sprint 111 — Promise.race timeout 30s em queue.waitUntilReady (#60) |
| S112 | `9c2daae` | #61 | feat(api): sprint 112 — BullModule connection tls:{} para Upstash rediss:// (#61) |
| S113 | `837c470` | #62 | fix(api): sprint 113 — jobId bootstrap-mercadona (sem ':' pra BullMQ v4+) (#62) |
| S114 | `b40c77d` | #63 | fix(api): sprint 114 — refactor jobIds ':' → '-' + logs/catch catalog-sync (#63) |
| S115 | `de10ecb` | #64 | fix(api): sprint 115 — bootstrap enqueue sem jobId (dedup silencioso BullMQ) (#64) |
| S116 | `b0ab67b` | #65 | fix(api): sprint 116 — auto-create Product em adapter oficial (unlock populate) (#65) |
| S118 | `f7e0882` | #67 | fix(app): sprint 118 — bloco 3 user flow bugs (route conflict + double €) (#67) |
| S118 | `eb8ab5e` | #68 | fix(api): sprint 118 follow-up — remove duplicate /products/categories handler (#68) |
| S119 | `f6a5bbe` | #69 | feat(api): sprint 119 — Carrefour adapter ativo + bootstrap multi-slug (#69) |
| S119 | `7e2e174` | #70 | fix(api): sprint 119 follow-up — bump catalog-sync worker concurrency 1→3 (#70) |
| S120 | `7233abd` | #71 | feat(api): sprint 120 — Carrefour anti-bot hardening (warmup + cookie session + retries=5) (#71) |
| S121 | `4c20363` | #72 | feat(api): sprint 121 — DIA adapter active (bootstrap pivot mercadona+dia) (#72) |
| S122 | `a9bd3ea` | #73 | fix(api): sprint 122 — DIA adapter real endpoint + parser (search-back) (#73) |
| S124 | `8092d6e` | #74 | feat(api): sprint 124 — EroskiAdapter (3º supermercado via HTML scraping) (#74) |
| S125 | `c53d690` | #75 | fix(api): sprint 125 — Eroski sitemap bareFetch (politeFetchRaw headers CDN filtered) (#75) |
| S126 | `8c3ca97` | #76 | feat(api): sprint 126 — LidlAdapter real + Aldi findings backlog (#76) |
| S127 | `15ba560` | #77 | feat(api): sprint 127 — AldiAdapter real (ofertas.html SSR scrape) (#77) |
| S128 | `ce7f959` | #78 | feat(api): sprint 128 — Puppeteer anti-bot bypass (Carrefour + Alcampo) (#78) |
| S129 | `c19c8d7` | #79 | fix(api): sprint 129 — chromium CJS/ESM resolve (prod S128 crash) (#79) |
| S130 | `f7d11f3` | #80 | fix(api): sprint 130 — disable Puppeteer slugs (OOM Render free tier) (#80) |
| S131 | `4b0089d` | #81 | feat(app+api): sprint 131 — /comparar matriz multi-super side-by-side (#81) |
| S132 | `5677bea` | #82 | feat(app+api): sprint 132 — home featured deals + PDP AggregateOffer offers[] (#82) |
| S133 | `a340e81` | #83 | feat(api): sprint 133 — Mercadona imgix→Blob migration (S117 nit) (#83) |
| S134 | `1952ca0` | #84 | feat(api): sprint 134 — Carrefour ressurreição (Render Starter + Puppeteer) (#84) |
| S134 | `35c53fe` | #85 | feat(api): sprint 134 revisada — Carrefour + Alcampo via ScrapingBee (ADR 0009 opção A) (#85) |
| S134 | `4848fd8` | #86 | fix(api): sprint 134-r — manual-sync priority + silent failure diagnostics (#86) |
| S134 | `e07eef6` | #87 | fix(api): sprint 134-r 2ª iteração — dedicated manual-sync queue (#87) |
| S134 | `ec56815` | #88 | fix(api): sprint 134-r follow-up — removeOnComplete/removeOnFail em manual queue (#88) |
| S135 | `dc4ac14` | #89 | feat(api+web): sprint 135 — storage migration Vercel Blob → Cloudflare R2 (ADR 0010) (#89) |
| S136 | `4668054` | #90 | feat(api): sprint 136 — BullMQ cron guards non-core (MVP $0/mês) (#90) |
| S137 | `7db5742` | #91 | feat(api): sprint 137 — Eroski manual sync + silent-failure fix (#91) |
| S138 | `0125a9c` | #92 | feat(api): sprint 138 — Carrefour + Alcampo manual local sync + prod cron guard (#92) |
| S139 | `44b4542` | #93 | fix(api): sprint 139 — puppeteer-extra stealth + PUPPETEER_EXECUTABLE_PATH docs (#93) |
| S140 | `855f1c9` | #94 | fix(api): sprint 140 — bundled Chrome como primary + install:chrome script (#94) |
| S140 | `488f5c0` | #95 | fix(api): sprint 140 P0 — tryResolveBundledChrome await Promise (#95) |
| S141 | `0a8a86d` | #96 | feat(api): sprint 141 — Froiz adapter impl + manual local sync + silent-failure guard (#96) |
| S142 | `0e148b3` | #97 | feat(api): sprint 142 — categorização massiva + fix upstream + backfill script (#97) |
| S142 | `dabfa1e` | #98 | fix(api): sprint 142 follow-up — backfill script hint call + matchKeyword guard (#98) |
| S143 | `94aa1bb` | #99 | fix(api): sprint 143 — resolveCategorySlug long-tail keywords + priority order (#99) |
| S144 | `7f86f3e` | #100 | fix(api): sprint 144 — carne cortes/aves + private labels Mercadona + caldo scope (#100) |
| S145 | `5ed66a6` | #101 | fix(api): sprint 145 — ultracongelados + pizza/bogavante/cigala + hielo (#101) |
| S146 | `b49986b` | #102 | fix(api): sprint 146 — higiene tintes/cabello + carne arreglo cocido (gap <10%) (#102) |
| S147 | `0167442` | #103 | feat(api+web): sprint 147 — advanced filters (ProductFilters expand + /categoria route + FilterBar + Zustand store) (#103) |
| S148 | `0cbc584` | #104 | fix(web): sprint 148 — /categoria initial filter fires fetch + i18n categoryNames (#104) |
| S149 | `6321f45` | #105 | fix(web): sprint 149 — /categoria useProducts fires + nested i18n fix (#105) |
| S150 | `63b0459` | #106 | fix(web): sprint 150 — /categoria useProducts loop: move hidratação Zustand pro useEffect + guard URL sync (#106) |
| S151 | `4476caa` | #107 | feat(web): sprint 151 — rollback /categoria + FilterBar + Zustand filters (5× gate 4 REPROVA) (#107) |
| S152 | `e26782f` | #108 | feat(web): sprint 152 — PDP package info strip (Bloco 4 polish pós-rollback S151) (#108) |
| S153 | `161254f` | #109 | feat(web): sprint 153 — search typeahead specs (home + /produto flow já em prod pré-S153) (#109) |
| S154 | `588468a` | #110 | feat(web): sprint 154 — DiscountBadge color-coded (home + ProductCard + PDP) (#110) |
| S155 | `354e19c` | #111 | fix(api): sprint 155 — FeaturedDeals threshold aceita promo single-super (#111) |
| S156 | `da37734` | #112 | fix(api): sprint 156 — FeaturedDeals DB-level promo filter (fix S155 cap janela) (#112) |
| S157 | `a815a2e` | #113 | fix(web): sprint 157 — FeaturedDeals accepts single-super with previousPrice (#113) |
| S158 | `10be6ee` | #114 | feat(web): sprint 158 — /alertas page polish (thumbnail, triggered group, empty state) (#114) |
| S159 | `fa81a61` | #115 | fix(web): sprint 159 — alert rule wizard silent fail (S158 nit P2) (#115) |
| S160 | `f09e0ab` | #116 | feat: sprint 160 — alert rule card inline actions (toggle + soft delete) (#116) |
| S161 | `37df048` | #117 | feat(web): sprint 161 — skeleton loading consistency (/alertas + /gastos) (#117) |
| S162 | `9b8a2fe` | #118 | feat: sprint 162 — /gastos dashboard polish (top products + empty state + delta color) (#118) |
| S163 | `dc44d93` | #119 | feat(web): sprint 163 — /minha-lista hybrid UX (per-item breakdown + most-expensive coral) (#119) |
| S164 | `016152f` | #120 | feat(web): sprint 164 — /favoritos page polish (count badge + empty states extracted) (#120) |
| S164 | `1ba6d62` | #122 | fix(web): sprint 164 gdpr mask + heart token nit (sprint 166 follow-up) (#122) |
| S165 | `161f177` | #121 | feat(web): sprint 165 — unit price display global (grid + /minha-lista) (#121) |
| S167 | `29b3d2a` | #123 | fix(api): sprint 167 pagination bug nutriScore (total + page slice) (#123) |
| S167 | `439080e` | #124 | fix(api): sprint 167 AJUSTE Reviewer — cap 20000 + fail-fast throw (#124) |
| S169 | `36a36c1` | #125 | fix(web): sprint 169 bundle 2 P1 bugs (/comparar empty + /perfil lang toggle logout) (#125) |
| S170 | `67731e5` | #126 | feat(web): sprint 170 /perfil logout above-fold + wizard progress bar (#126) |
| S171 | `54b0528` | #127 | feat(web): sprint 171 rose→coral token sweep + bottom nav micro-interactions (#127) |
| S172 | `3810749` | #128 | feat(web): sprint 172 PDP reviews filter commentsOnly + regression spec (#128) |
| S173 | `d01e89a` | #129 | feat(web): sprint 173 /minha-cesta basket category groups (#129) |
| S174 | `e798ec7` | #130 | feat(web): sprint 174 compare matrix polish (lima cheapest + unit price + sort toggle) (#130) |
| S175 | `87c9014` | #131 | fix(web): sprint 175 compare radio helper stale (anon user sortMode) (#131) |
| S176 | `a96282b` | #132 | feat(web): sprint 176 /gastos receipt upload polish (preview + retry + OCR text) (#132) |
| S176 | `2615b93` | #133 | fix(web): sprint 176 AJUSTE Reviewer GDPR granular unmask (file.name PII) (#133) |
| S177 | `1d009e3` | #134 | fix(api): sprint 177 HOTFIX P1 sharp CJS require (OCR worker crash prod) (#134) |
| S178 | `521388b` | #135 | fix(api): sprint 178 enable esModuleInterop root fix (ADR 0011) (#135) |
| S179 | `8606683` | #136 | feat(web): sprint 179 fuzzy suggestions typo tolerance (Fuse.js post-fetch) (#136) |
| S180 | `59e3655` | #137 | fix(api): sprint 180 fuzzy backend pg_trgm + ADR 0012 (S179 G1 FAIL) (#137) |
| S181 | `fb7b5a3` | #138 | fix(api): sprint 181 fuzzy threshold word_similarity (S180 similarity dilution) (#138) |
| S182 | `981ab30` | #139 | fix(api): sprint 182 fuzzy rerank boost direct-match first word (#139) |
| S183 | `a23263f` | #140 | fix(api): sprint 183 prisma neon deploy resilience (ADR 0013) (#140) |
| S183 | `dcc5839` | #141 | fix(api): sprint 183 AJUSTE render-build.sh retry count off-by-one (#141) |
| S183 | `80119f3` | #142 | fix(api): sprint 183 AJUSTE Boss — derive DATABASE_URL_UNPOOLED in script (#142) |
| S184 | `886bc25` | #143 | fix(ops): sprint 184 render dashboard blueprint sync (ADR 0014) (#143) |
| S185 | `e376a89` | #144 | fix(api+ops): sprint 185 fuzzy ordering deterministic + S184 nits (#144) |
| S186 | `7c0495f` | #145 | fix(api): sprint 186 lidl adapter yield recovery (ADR 0016) (#145) |
| S187 | `cfc30d0` | #147 | chore(api): sprint 187 nits cleanup bundle (#147) |
| S188 | `452d428` | #148 | feat(ops+api): sprint 188 prod restoration readiness (ADR 0017) (#148) |
| S189 | `2ca5276` | #149 | feat(ops+api): sprint 189 smoke expand + shared retry util (#149) |
| S189 | `0ae9a8c` | #150 | fix(api): sprint 189 AJUSTE — add missing /auth/health endpoint (#150) |
| S190 | `ac2dd2c` | #151 | refactor(api): sprint 190 revalidate retry → withRetry util (#151) |
| S191 | `00b2ae4` | #152 | feat(api): sprint 191 BullMQ worker observability (#152) |
| S192 | `f916332` | #153 | feat(web): sprint 192 frontend Sentry breadcrumbs (GDPR-safe) (#153) |
| S193 | `ec80147` | #154 | feat(api+web): sprint 193 close S71 nit backlog (#154) |
| S193 | `b793af6` | #155 | fix(api): sprint 193 AJUSTE — exclude /ready from /api/v1 global prefix (#155) |
| S194 | `e652e09` | #156 | chore(ci): sprint 194 coverage threshold gate rebase (#156) |
| S195 | `f1c25d4` | #158 | chore(deps): sprint 195 npm audit sweep — semver-safe fixes (#158) |
| S196 | `2acc39f` | #159 | feat(web+ci): sprint 196 i18n parity audit gate (#159) |
| S197 | `a5ce25e` | #160 | feat(web+ci): sprint 197 a11y audit gate (axe-core + jsdom) (#160) |
| S198 | `3c215d5` | #161 | feat(web+ci): sprint 198 Playwright E2E infra setup (#161) |
| S199 | `80d5d1e` | #162 | feat(web+ci): sprint 199 bundle size CI gate (ADR 0019) (#162) |

---

## [Released] — Sprint 100 (MARCO)

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
