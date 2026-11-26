# ADR 0020 — Sprint 200 MARCO consolidate (S101–S199 backfill)

- **Date:** 2026-11-26
- **Status:** Accepted (Sprint 200)
- **Supersedes:** nothing (complementa ADR 0001–0019).
- **Related CHANGELOG section:** `[Unreleased] — Sprint 200 (MARCO)`.
- **Related audit:** `docs/audit-s200.md`.

## Context

Sprint 100 foi o primeiro marco (S1–S99 consolidate). De lá até S199 rodamos **115 commits em 99 sprints** sem outro marco. CHANGELOG ficou com buraco S101–S199. Prod `cesta-api` em Render está **SUSPENDED** desde 2026-11-26 (free tier estourou) — decisão de user pendente, então este marco é **code-only, zero prod touch** (memory `project-render-suspended-billing-2026-11`, `project-mvp-stack-zero-cost`).

MVP (memory `project-mvp-definition`) = catálogo real + preços reais + fotos. Blocos 1–3 foram foco P0 forçado. S200 fecha o gap documental sem adicionar scope.

## Decision

S200 é um **sprint de consolidação código-reproduzível**, não de feature. Cinco entregáveis:

1. **`scripts/changelog-backfill.mjs`** — helper reproduzível: `git log <base>..HEAD` → tabela `Sprint × SHA × PR × subject`. Suporta `--base`, `--from N`, `--to N`, `--json`. Zero deps externas (só `node:child_process` + `git`). Default base = `f1896ed` (commit S100 marco).
2. **CHANGELOG backfill S101–S199** — seção `[Unreleased] — Sprint 200 (MARCO)` em `CHANGELOG.md`, cada entry com SHA de 7 chars **verificável** via `git show <sha>` (regra memory `feedback-changelog-anti-hallucination`). S100 section renomeada `[Released] — Sprint 100 (MARCO)`.
3. **`docs/audit-s200.md`** — snapshot MARCO dos 5 gates (api coverage, web coverage, i18n parity, a11y audit, bundle size): config de thresholds + estado CI + estado local, com JSON block consumível.
4. **Este ADR** — consolidate learnings (patterns, deferred bugs, follow-up).
5. **CI verde** — branch `chore/sprint-200-marco-consolidate` passa todos os gates antes de merge.

Zero prod touch. Nenhum deploy. Nenhuma mudança de schema, config de ambiente, ou feature flag.

## Patterns observados S101–S199

Lições codificáveis extraídas dos 115 commits. ADRs 0009–0019 cobrem detalhes; esta seção é o resumo cross-ADR.

### 1. Adapter evolution — HTML scraping > browser automation > managed proxy

- **Fase 1 (S119–S127):** HTML scraping direto (Mercadona, DIA, Eroski, LIDL, Aldi). CDN-friendly pattern: `bareFetch` para sitemap/robots (headers de datacenter filtrados por Akamai), `politeFetch` só para páginas produto (memory `feedback-cdn-bare-fetch`).
- **Fase 2 (S128–S130):** Puppeteer tentativa para Carrefour + Alcampo. **OOM imediato** em Render free tier (512MB). Rollback S130.
- **Fase 3 (S134-revisada):** ScrapingBee managed proxy (free tier 1000 calls/mês, memory `project-scrapingbee-api-available`). ADR 0009. **Sustainable solution** sem estourar Render RAM.

**Takeaway:** começar pela opção leve (HTTP+Cheerio); escalar só quando CDN bloqueia; browser automation é último recurso quando bolso permite spin-up dedicado.

### 2. CI gate escalation — baseline → enforce

Padrão repetido S194+S196+S197+S199:
1. Introduz script de gate com `continue-on-error: true`.
2. Primeira run captura baseline real.
3. Review Dev + Boss ajusta threshold razoável (ou flagga fix).
4. Próximo sprint flip `continue-on-error: false`.

Aplicado em: coverage threshold (S194), i18n parity (S196 — já enforce de cara, leaves aligned), a11y audit (S197), bundle size (S199 em baseline, S20X enforce). ADR 0019 documenta mais fundo.

### 3. UX polish per-route — S147–S176

16 sprints seguidas de polish per-route após MVP catálogo (Blocos 1–2 fechados). Rotas revisadas: `/alertas`, `/gastos`, `/favoritos`, `/minha-cesta`, `/minha-lista`, `/perfil`, `/comparar`, PDP, home. Pattern: skeleton loading consistency (S161), empty states extraídos (S164), unit price global (S165), micro-interactions (S171). **Deliberadamente serializado** — feature-flagging + rollback em paralelo em S147–S151 (advanced filters 5× gate 4 REPROVA, rollback S151) mostrou custo de fan-out UI sem gate forte.

### 4. Rollback discipline

Dois rollbacks documentados em S101–S199:
- **S130** — disable Puppeteer slugs pós-OOM Render. Sem ADR dedicado; triggered by prod crash.
- **S151** — rollback `/categoria` + FilterBar + Zustand filters após 5× gate 4 REPROVA. S152 reiniciou polish em escopo menor.

**Takeaway codificado:** Reviewer tem veto (gate 3) + QA tem veto empírico (gate 4); 3× REPROVA é sinal forte para rollback vs tentar fix N+1.

### 5. Fuzzy search layered strategy — S179–S185

Evolução em 7 sprints:
- S179 Fuse.js post-fetch (frontend) → gate 3 G1 FAIL (não escalável N produtos).
- S180 pg_trgm backend (ADR 0012).
- S181 tune word_similarity threshold.
- S182 rerank boost direct-match.
- S185 deterministic ordering (ties broken por `id` ascendente).

**Takeaway:** search quality é sprint continuous — thresholds mensuráveis + ties determinísticos evitam flapping.

### 6. Prod resilience — S177 → S188

- S177 (HOTFIX P1) — sharp CJS require crashava OCR worker (`require('sharp')` sem `esModuleInterop`).
- S178 — root fix `tsconfig` `esModuleInterop: true` (ADR 0011).
- S183 — Prisma/Neon deploy resilience (retry loop + `DATABASE_URL_UNPOOLED` derivation) (ADR 0013).
- S184 — Render dashboard blueprint sync drift (ADR 0014).
- S186 — LIDL adapter yield recovery (gerador silencioso) (ADR 0016).
- S188 — prod restoration playbook (ADR 0017): dry-run sem touch, documenta sequência quando Render volta.

### 7. Observability + hardening — S188 → S194

- S188 smoke test prod scope expand.
- S189 shared `withRetry` util.
- S190 refactor revalidate retry → withRetry.
- S191 BullMQ worker observability (progress + duration + queue depth logs).
- S192 Sentry breadcrumbs frontend com scrubbing GDPR.
- S194 coverage threshold gate rebase.

## Deferred bugs e follow-up

### Prod blockers (não resolvidos code-only)

| Item | Owner | Status | Gating |
|---|:---|:---|:---|
| Render billing restoration | User | Pendente decisão | Nenhum sprint prod até resolve |
| Prod smoke run (ADR 0017 playbook dry-run) | Boss | Blocked por item acima | S20X |
| Bundle size `continue-on-error` flip | Dev | Backlog S20X | Baseline S199 review |

### Nits capturados em `docs/audit-s200.md`

- S20X-nit-01: `a11y-audit.mjs` spawn ENOENT em Windows (shell flag).
- S20X-nit-02: `bundle-size.mjs` fallback silencioso sem manifest (opt-in `--require-manifest`).
- S20X-bundle-enforce: flip CI enforcement para bundle size.

### Rolling nits backlog (memory `project-sprint-109-backlog`)

Permanecem válidos para S20X: cast guard, `$transaction` recovery, brand parsing robustness, spec default wh, `AUTO_SYNC_ON_BOOT` parse robustez, hook test coverage.

## Alternatives considered

**A) Pular MARCO e continuar sprints feature:**
- Pros: zero overhead de meta-sprint.
- Cons: CHANGELOG vira "só S1–S99" indefinidamente; onboarding de futuros contributors impossível sem rodar `git log` manual; memória `feedback-changelog-anti-hallucination` já exige SHA em cada claim, e sem CHANGELOG não há onde registrar.
- **Decisão:** rejeitado.

**B) Backfill manual sem script:**
- Pros: sem código novo.
- Cons: não-reproduzível; próximo MARCO (S300?) precisaria do mesmo esforço manual; viola princípio DRY.
- **Decisão:** rejeitado. Script `changelog-backfill.mjs` é reusável.

**C) Gerar CHANGELOG automático via `semantic-release` ou `conventional-changelog`:**
- Pros: zero custo de MARCO futuro.
- Cons: subordina estrutura do CHANGELOG ao commit format estrito (breaking vs feat vs fix); nossa prática usa `feat(scope): sprint N — subject (#PR)` que mistura escopo + sprint tag; migração de 115 commits históricos fora do escopo; dep externa.
- **Decisão:** rejeitado para S200. Reavaliar S400 se ritmo de sprints crescer.

## Consequences

**Positivas:**
- CHANGELOG retoma utilidade — todo claim reconstruível via `git show <sha>`.
- Próximo MARCO (S300?) é `node scripts/changelog-backfill.mjs --from 201 --to 299` + append + ADR rename. Mesmo template.
- Audit snapshot MARCO (`docs/audit-s200.md`) é padrão replicável — JSON block consumível por tooling.
- ADR 0020 serve de rota de leitura rápida para onboarding (100+ sprints resumidas em patterns).

**Negativas:**
- CHANGELOG cresceu ~110 linhas (tabela). Aceitável — Keep-a-Changelog não limita tamanho.
- S20X-nit-01 (a11y Windows) continua latente; não bloqueia CI mas atrita dev local em Windows.

## Follow-up

- **S20X:** flip bundle size `continue-on-error: false` após review de baseline S199.
- **S20X:** fix a11y audit Windows spawn.
- **S20X ou prod unblock:** dry-run do prod restoration playbook (ADR 0017) quando Render volta.
- **S300 (futuro):** reusar `scripts/changelog-backfill.mjs --from 201 --to 299` + mesmo template de ADR consolidate.
