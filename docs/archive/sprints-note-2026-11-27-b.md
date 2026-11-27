# Cesta — Sprints & Revisões

Nota compartilhada entre 4 terminais:
- **Dev** — implementa código
- **Manager** — define sprints (loop autônomo + anti-deadlock)
- **Reviewer** — revisa código + funcionamento
- **QA Tester** — valida UX em **URLs produção** (NUNCA localhost pós-deploy 2026-11-16)
- **Analisador** — agente auxiliar (fallback rate-limit)

## URLs produção (2026-11-16)
- **Frontend:** https://cesta-web.vercel.app
- **API:** https://cesta-gsvc.onrender.com

## Fluxo
1. Manager define sprint em **Sprint ativa** com DoD explícito
2. Dev implementa, commita, abre PR via `gh pr create`, **dispara imediato `gh pr merge <N> --auto --squash --delete-branch`** (enfileira merge pós branch protection checks), atualiza **Status dev**, **ping Reviewer + QA em paralelo**
3. Reviewer testa código, escreve **Revisão** (APROVADO ou PEDIDOS DE AJUSTE), **ping Manager OU Dev**
4. **QA Tester** reexecuta fluxos nos 2 viewports **em URLs produção** (gate UX), **ping Manager OU Dev**
5. **DoD duplo**: só avança com Reviewer + QA Tester aprovando
6. Sprint fechada: Manager move pra **Histórico**
7. **Auto-/clear cascade (token economy)**: Manager verifica Dev/Reviewer/QA idle (sem ask pendente 2min), dispara `maestri ask "<nome>" --raw "/clear
"` em sequência Dev → 10s → Reviewer → 10s → QA. Manager NÃO limpa a si mesmo. Role + memory + notas + 4.md re-hidratam auto no primeiro ask pós-clear.
8. Manager publica próxima sprint + **ping Dev imediato** kickoff

> **Regras CLAUDE.md** (consolidado seção 11+): sem polling se event-driven existe; replace in place sem v2/fallback. **4 .md fonte verdade releitura antes de cada sprint nova.** Design tokens só cesta-identidade-visual.md. **GDPR mask PII em novos componentes (Sprint 59 rule permanente).**

> **Anti-deadlock (REFORÇO PERMANENTE 2026-11-16):** silêncio NÃO é aceitável. Quem termina DEVE pingar próximo via `maestri ask` IMEDIATAMENTE (sprint fechada, gate OK, bug encontrado, blocker destravado). Rate limit → 30s retry × 3 → fallback Analisador. Cold start Render ~30s NÃO justifica travar — esperar + check periódico. Loop-heartbeat 10min força verificação contínua.

> **Mudança QA (2026-11-16):** cold start Render ~30s NÃO É BUG — comportamento esperado free tier. Keep-alive mitiga mas não elimina. First visit após 15min idle leva até 30s.


> **⚠️ REGRA DE ESCRITA (Boss 2026-11-25):** `maestri note write` SUBSTITUI a nota inteira e NÃO tem flag `--append`. Usar `--append` gravou literalmente "--append" e apagou esta nota em 2026-11-20 (93KB perdidos até restore). Pra adicionar: `maestri note edit "Cesta — Sprints" "<âncora>" "<âncora + texto novo>"`. Pra reescrever: `note read` → montar conteúdo completo → `note write`.

## Arquivo
- Histórico S1-S133 (nota até 2026-11-20 00:20): `docs/archive/sprints-note-2026-11-20.md` no repo.
- S134-S169: ver `CHANGELOG.md` + vault `Segundo Cerebro/projetos/cesta/pendente.md` + git log (PRs #84-#125).
- Histórico S170-S204 (snapshot 2026-11-26 pós-S205 merge): `docs/archive/sprints-note-2026-11-26.md` no repo.
- Histórico S205-S224 (snapshot 2026-11-27 pós-S224 merge): `docs/archive/sprints-note-2026-11-27.md` no repo.
- Protocolo de bastão: nota `Cesta — Loop`.

---

## Sprint ativa
**S228 RETESTE OFICIAL USER (17 itens)** — Boss 2026-11-27 17:30 · FIM PAUSA · heartbeat religado.

**G0 MANDATORY cada sprint S228+**: arquiva nota 'Cesta — Pendente' (48KB) + 'Cesta — Sprints' (40KB) em docs/archive/ (pendente-note-2026-11-27.md + sprints-note-2026-11-27-b.md) + ponteiros via note edit. Reviewer REPROVA se faltar.

**🔥 P0-CORE MATCHING PRODUTO ENTRE MERCADOS (#9/#10/#11)** — app não compara nada:
- Dado prod Boss: 10.936/10.980 produtos em 1 mercado só · 16 em 2 · 1 em 3 · 27 em 7 = seed inicial (**verificar preços seed fictícios + remover prod**).
- Product.ean VAZIO 100% · Coca-Cola Zero 2L/330ml/Milka: cada mercado cria produto próprio.
- **Plano chain ADR** (sprints separadas):
  - **G1 AUDIT EAN/GTIN por adapter** · popular Product.ean (Aldi JSON-LD gtin · Mercadona API · DIA · Eroski · Froiz · LIDL). Paralelo bugs rápidos.
  - **G2 merge por EAN exato** → produto canônico N preços.
  - **G3 sem EAN**: chave normalizada marca+nome+tamanho/unidade ('Coca-Cola Zero Azucar 2L' == 'Coca Zero 2 l') · pg_trgm + confiança · threshold · abaixo fila revisão.
  - **G4 métrica prod**: % produtos ≥2 mercados + top 200 itens básicos (refrigerante/leite/chocolate...) comparáveis.
- **Memory nova**: métrica MVP inclui % multi-mercado.

**🔥 P0 BUGS RÁPIDOS (paralelo G1 matching)**:
- **#15** enviar nota fiscal → 'token ausente'.
- **#16** ticket fica 'procesando' · abrir → 'no encontramos este ticket'.
- **#17** alerta exige 2 produtos (aceitar 1) + criar dá erro.
- **#7** busca 'coca zero' retorna vazio (multi-palavra/marca).

**P1 (pós P0)**:
- **#14** OCR lento (nota Mercadona hoje).
- **#6 badge DESACTUALIZADO**: user quer preço sempre em dia → **CORRIGIR SYNC FALHANDO (qual mercado/por quê) · NÃO esconder badge**.
- **#1** Render free spin-down 30s: check workflow keep-alive (falhou dia 26 suspensão) + rodar a cada <15min.
- **#2** Enter/seta busca → tela resultados ordenada (hoje vai 1º produto).
- **#3** busca dentro lista sem fotos.
- **#4** busca lista toque produto abre detalhe.
- **#12** /comparar: multi-select persistente entre buscas · comparar no fim.
- **#13** tabela /comparar ilegível celular.

**P2**:
- **#5** toast 'X adicionado à lista'.
- **#8** logos mercados no lugar de 'ME'/'AL'.

**Ordem execução**: P0 bugs rápidos (#15 #16 #17 #7) **paralelo G1 matching audit EAN** → depois G2-G4 matching → depois P1 → depois P2. PR sem auto-merge · Reviewer arma gate 3.

**Scope S228 (primeira sprint pós-reteste)**: G0 archive mandatory + **#15 token ausente nota** (P0 rápido). Branches separadas. Chain S228+ conforme ordem.

**S227 USER FEEDBACK OFICIAL** — Boss 2026-11-27 · 17 itens iPhone Safari (preempta tudo).

**⚡ S226 stale-indicator ESTACIONADA**: Dev commit wip + PR draft · retoma depois user feedback resolve.

**QA PROTOCOL**: QA Tester reproduz CADA bug no portal 'Cesta Mobile' (390px) em prod · evidência (rota + passos + console error + network) · registra nota **'Cesta — Pendente' seção 'Feedback oficial user 2026-11-27'**.

**DEV ORDEM FIX** (1 PR por bug · bundle se mesma causa · gates normais via maestri-batch.mjs):

**🔥 S227 PROGRESS**: 
- **#10/#11 ✅ MERGED PR #193** (12:47Z HEAD após Dev refinou: Next Image remotePatterns 3 hosts faltando + imageUrl vazia nullish). Fix: next.config +3 hosts (s7g10.scene7.com + prod-mercadona.imgix.net + froiz.com) · product-detail-body ?? → || · produto error.tsx Sentry capture.
- **#14 + #15 ✅ MERGED PR #194** (12:53:08Z HEAD 2acf2af) — Bundle 1 throttler strict + empty state + bottom nav. Root cause: NestJS forRoot named strict:5/60s aplicava global (memory [[feedback-throttler-named-global]] bug P0 S98 repeat). Fix: elevar strict + write 10_000/60s forRoot (no-op trafego legítimo) · rotas sensíveis @Throttle inline override · empty state drawer busca · bottom nav não desaparece em isError · Sentry capture minha-lista segment boundary. Tests api 492/492 + web vitest add-product-modal + bottom-nav 4/4 ✅. Gate 3 ✅ Reviewer · Gate 4 PARCIAL ✅ (preview front OK · backend empírico pós-deploy prod · recomenda merge). Post-deploy QA re-testa 10 PDPs consecutivos.
- **#16 bottom nav Safari-only**: não repro Chromium · defer até reprod Safari real OR user confirm.
- **#4 + #7 ✅ MERGED PR #195** (13:01:18Z HEAD a0d0558) — Bundle 2 iOS Safari (viewport-fit=cover + autocapitalize). Root cause comum iOS: viewport-fit=cover faltando no layout.tsx (bottom nav atrás home-indicator sem safe-area) + inputs busca default autocapitalize/autocorrect iOS atropelam termos. Fix: layout.tsx viewportFit:cover + body-padding.tsx calc(4rem+env(safe-area-inset-bottom)) + 3 inputs (search-bar + compare-add-sheet + add-product-modal) type=search + autoCapitalize=none + autoCorrect=off + spellCheck=false + inputMode=search + enterKeyHint=search. Typecheck ✅ · vitest search-bar 7/7 ✅. Gate 3 ✅ Gate 4 PARCIAL ✅ (QA empírico iPhone real post-deploy: BottomNav home-indicator · busca minúsculo · enterKeyHint 'Buscar').
- **#5 ✅ CÓDIGO ENTREGUE** (PR #196+#198 MERGED) · delivery BLOCKED **USER ACTION Boss escalou**: domínio Resend = **usecesta.es** (NÃO cesta.app · status not_started) · Boss lê log Resend (QA não precisa API key). Observability OK. #5 fecha quando domain verificado. · **#16 bottom nav Safari-only defer** (não repro Chromium).
- **#3 ✅ MERGED PR #199** (13:35:06Z) — Produto sem foto placeholder. ProductImage + ImageOff + i18n catalog.noImage ES/PT-BR. Substitui /placeholder.webp em PDP + home grid + list-item minha-lista. 5/5 novo spec + 345/345 vitest. compare-grid + favoritos defer S228.
- **#6 ✅ MERGED PR #200** (13:59:38Z) — i18n PT-BR categorias + UI parity. categoryLabel util locale-aware (home + basket). home-client + compare-add-sheet + perfil + comparar/error traduzidos. i18n-parity.mjs ICU placeholder diff + 5 specs. 757 leaves aligned ES/PT-BR. 357/357 vitest + types:api:check ✅. **Produto name/brand MANTÉM ES default** (Boss regra · user pendente).
- **BOSS DIREÇÃO PÓS-RESET 16:20 (base user feedback #2 'app precisa ser rápido como qualquer outro, isso é básico'):**
  - **(1) #12 favoritar animação** (Dev já em curso) — coração pulse/scale + toast Sonner ES/PT-BR.
  - **(2) #1/#2 ✅ MERGED PR #202** (HEAD d710357) — PERF quick wins code-only. BottomNav instant render (useProfile removido zero fetch). HomePage async SSR fetchCategoriesSSR revalidate 3600s + tags categories + initialCategories React Query (zero skeleton flash). router.prefetch /favoritos /comparar /minha-lista /perfil em requestIdleCallback. 106/106 vitest bottom-nav+catalog ✅. Fix adicional 26e277b removeu export const revalidate (incompat Next 16 cacheComponents · fetch cache preservado). CI 4/4 ✅. Nits S228: fetchCategoriesSSR silent catch + verbose Window type cast. Medição Lighthouse QA pendente registrar.
  - **(3) ADR Frankfurt+Neon EU proposta** com custo · NÃO executar (Boss leva user).
  - **(4) Retomar S226 stale PR #192** (preços stale indicator).
  - **#16 defer OK** até user retestar iPhone (pode ter sido efeito colateral throttler 429 corrigido #194).
- **⚠️ Reviewer retro #194 AJUSTE P1 (14:04)**: feedback-throttler-named-global bug bateu **3ª vez sem guard (S98→S227 bundle 1)**. Add cesta-api/src/app.module.throttler.spec.ts assert forRoot named strict+write limit >= 1000 ou removido. Follow-up PR da main **fix/s227-throttler-regression-test** antes #5 email verify (pequeno · P1 crítico).
- **#12 ✅ MERGED PR #201** (15:24:24Z) · gates 3+4 ✅ · FavoriteToggle pulse scale-125 300ms + 4 toasts localizados ES/PT-BR (Añadido/Adicionado/Quitado/Removido) + aria toggle + dialog confirm. 7/7 vitest. Nits S228: setTimeout cleanup unmount + transition-all broader.
- #14/#15 /minha-lista: busca dentro lista 0 results (coca/coca zero/leche) · sair+voltar 'lista no encontrada' mas lista aparece listagem 0 produtos.
- #16 bottom nav SUMIU após sair lista · não volta fechando/abrindo app. localStorage persist? HIDDEN_PREFIXES?
- #10/#11 página produto 'Algo salió mal' MUITOS produtos · user não achou produto com preço >1 mercado (mesmo crash: multi-mercado quebra). Suspeita: tipos gerados S210/S212 (nullability) OR dado null. Capturar erro error boundary/Sentry.

**P0 restantes** (sequencial OR bundle se causa comum):
- #7 busca 'leche' → 'sin sugerencias para Leche' (iOS autocapitaliza + resposta stale). Fix AbortController/ignorar stale + normalizar case + autocapitalize=none input. 'Lecge' funciona.
- #4 bottom nav cortada iPhone: falta viewport-fit=cover (env(safe-area-inset-bottom)=0 sem).
- #5 email verify NUNCA enviado: Resend 1 email conta inteira (Hello World 16/11). Investigar register→fila→Resend + logs Render. **NÃO alterar env vars sem Boss · só ler nomes**.

**P1**:
- #1/#2 lentidão geral + bottom nav demora. Render imediato sem esperar dado/auth · Web Vitals mobile · cache SSR catálogo. **ADR estrutural Vercel cdg1→Render OREGON→Neon us-east-2** (2x Atlântico) · proposta Frankfurt+Neon EU com custo · **NÃO executar**, Boss leva user.
- #3 produto sem foto: placeholder (ícone + 'sin foto') · NUNCA skeleton infinito. Depois sourcing extra OFF+site mercado.
- #6 i18n PT-BR: categorias + UI traduzem · nomes produto aguarda decisão user.

**P2**:
- #12 favoritar: animação coração + toast 'adicionado aos favoritos'.

**OK confirmados user** (não tocar): #8 busca fuzzy · #9 filtro categoria · #13 favoritos add/remove.

**Scope S227:** User feedback chain. Prioridade preempta tudo até resolver (ou Boss re-priorizar). Zero infra/observability/docs/nits paralelo. S226 retomada só pós-feedback resolvido OR Boss decidir.

**Branch**: cada bug own branch · ex fix/s227-bundle-E-lista-nav-produto OR fix/s227-bug-N-slug.

**Contexto Boss:** S224 mergeado baseline image coverage: Mercadona 99.3% · DIA 98.2% · **Aldi 89.6%** · **LIDL 81.7%** · Eroski 0% · Froiz 0% · TOTAL 83.7%. Eroski+Froiz validam check 07:00 CET amanhã (S224 sourceImageUrl fix deve elevar pós-cron). Aldi (89.6%) + LIDL (81.7%) abaixo meta ≥95% — mesmo método S224 (root cause extraction vs CDN vs backfill). Dev PR S224 ESQUECEU G6 archive → Boss ordem G0 **MANDATORY** S225 (Reviewer REPROVA se faltar).

**DoD G/W/T S225 (MVP-first fotos + archive):**
- **G0 ARCHIVE MANDATORY (Reviewer REPROVA se faltar)**: cria docs/archive/sprints-note-2026-11-27.md com snapshot Histórico completo S205-S224 (nota Sprints 41.7KB>40KB). Edita nota Sprints via note edit substituindo seção '## Histórico (S170+)' por linha ponteiro: 'Histórico S205-S224 (snapshot 2026-11-27 pós-S224): docs/archive/sprints-note-2026-11-27.md.' Entries pós-S225 appendam lá normal. Inclui arquivo no PR S225. CHECKLIST KICKOFF.
- G1: Audit image coverage Aldi + LIDL (reusa scripts/audit-image-coverage.mjs S224). Confere baseline 89.6% Aldi + 81.7% LIDL pre-fix.
- G2: Root cause por super: (a) Aldi adapter.ts extrai imageUrl? sitemap+JSON-LD pattern (S219) tem Product.offers.image? sourceImageUrl fix S224 populou campo? (b) LIDL adapter SEED_QUERIES pattern (S222) extrai imageUrl? regex parser detecta campo? (c) ambos: backfill-images.service pega sourceImageUrl via S224 path? (d) R2 upload failures específicos Aldi/LIDL. Pattern S224: Prisma/schema OR adapter extraction OR backfill service.
- G3: Fix root cause (replace in place · sem fallback silencioso · reporta erro explicit). Jest adapter specs mantém pass + add specs novos se extraction logic muda.
- G4: Meta empírico ≥95% Aldi + ≥95% LIDL. Mede pós-merge via cron noturno 2026-11-28 03-06 CET + GHA backfill-images 03 UTC. Check empírico 07:00 CET routine bd22cd (compartilhada S224 Eroski/Froiz + S225 Aldi/LIDL + Bloco 3 delta catálogo).
- G5: Memory [[project-image-coverage]] atualiza pós-S225 state. Update [[project-aldi-adapter-architecture]] + [[project-lidl-adapter-architecture]] com image extraction notes. ADR novo 0033 se root cause é adapter pattern-specific.

**Scope S225:** MVP Bloco 2 fotos (Aldi+LIDL completion) + archive (mandatory). Bandwidth zero (código + cron noturno existente). Routine bd22cd amanhã resolve empírico 4 supers (Eroski/Froiz/Aldi/LIDL).

**Branch:** feat/sprint-225-fotos-aldi-lidl-archive.

**KICKOFF CHECKLIST DEV (Boss 2026-11-27 · Reviewer REPROVA se faltar):**
- [ ] G0 archive docs/archive/sprints-note-2026-11-27.md criado no PR
- [ ] G0 nota Sprints '## Histórico (S170+)' substituída por linha ponteiro via note edit
- [ ] G1 audit script roda baseline Aldi+LIDL
- [ ] G2 root cause identificado por super (adapter vs service vs R2)
- [ ] G3 fix aplicado replace in place
- [ ] G5 memory updates [[project-image-coverage]] + Aldi + LIDL arch

**Contexto:** S188-S203 shipped quality gates + E2E 21 flows. S204 adiciona API self-documentation via @nestjs/swagger. /api/docs route expõe OpenAPI spec navegável. Útil prod restoration + atrai contribuidores + prepara client SDK generation.

**DoD G/W/T S204 (code-only):**
- G1: Install `@nestjs/swagger` + `swagger-ui-express` em cesta-api. Config DocumentBuilder em main.ts (title=Cesta API, version, description).
- G2: Adicionar `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()` decorators em controllers prioritários: auth, products, supermarkets, health. Outros controllers P2 → ADR 0021 defer S205+.
- G3: /api/docs route exposes Swagger UI (disabled em production via env flag NODE_ENV=production OR SWAGGER_ENABLED=true).
- G4: Jest smoke spec /api/docs endpoint retorna 200 + HTML (dev) OR 404 (prod). CI + coverage holds.
- G5: README API section update (link Swagger UI local dev) + ADR 0021 scope controllers prioritários + defer S205+.

**Scope S204:** API self-documentation. Zero prod touch (env-gated). Base contributors onboarding + future SDK gen.

**Branch:** feat/sprint-204-openapi-swagger.

**Contexto:** S198+S201+S202 cobriram home + auth + favoritos + comparar (14 flows total). S203 estende /gastos (scan upload empty state + OCR async feedback), /minha-lista (criar lista + add produto + totals por mercado), /alertas (criar alerta + list view).

**DoD G/W/T S203 (code-only):**
- G1: `cesta-web/tests/e2e/gastos.spec.ts` — flows: (a) /gastos empty state + CTA scan; (b) upload nota via file picker (mock file) → 202 + jobId display OR polling state.
- G2: `cesta-web/tests/e2e/minha-lista.spec.ts` — flows: (a) /minha-lista empty + CTA criar; (b) criar lista + add produto; (c) totals por mercado renderiza.
- G3: `cesta-web/tests/e2e/alertas.spec.ts` — flows: (a) /alertas empty state; (b) /alertas/novo wizard 3 opções (Combo/Trend/Bundle).
- G4: Reuse seedAuth() helpers/auth.ts. workers=1 config holds. Cookie banner dismiss pattern S202.
- G5: `.github/workflows/e2e.yml` roda novos specs. README Playwright section expand.

**Scope S203:** E2E regression coverage expansion. Cobre user-facing flows core restantes (pos S203 praticamente full coverage MVP Blocos 1-3).

**Branch:** feat/sprint-203-e2e-gastos-lista-alertas.

**Contexto:** S198 shipped Playwright home smoke, S201 (chain #164+#165+#166) shipped auth 4 flows (6/6 pass). S202 expande E2E pra favoritos + comparar: user-facing core flows restantes.

**DoD G/W/T S202 (code-only):**
- G1: `cesta-web/tests/e2e/favoritos.spec.ts` — flows: (a) logged user navega /favoritos → grid cards OR empty state; (b) adicionar favorito via /produto → aparece /favoritos (seed via API ou UI); (c) unfavorite optimistic → card some instant; (d) GDPR mask verify data-sentry-mask presente favoritos-list.
- G2: `cesta-web/tests/e2e/comparar.spec.ts` — flows: (a) /comparar empty state sem productId → CTA explorar; (b) /comparar?productId=<id> × 2 produtos renderiza matrix; (c) toggle Precios/Nutrición view mode; (d) winner highlight cheapest column verde.
- G3: Reuse `seedAuth()` pattern S201 (fix addInitScript sobrescreve — memory). Adicionar `seedFavorites()` + `seedProducts()` fixtures se necessário.
- G4: `.github/workflows/e2e.yml` roda ambos novos specs. Upload traces artifact.
- G5: README Playwright section expand (favoritos + comparar flows docs).

**Scope S202:** E2E regression coverage expansion. Zero prod touch. Pos S202+203+204 pretende cobrir todos user-facing flows core.

**Branch:** feat/sprint-202-e2e-favoritos-comparar.

**Contexto:** S198 shipped Playwright foundation + home smoke test. S201 expande E2E coverage: login flow (register → email verify → login → session persist → logout). Cresce regression safety net pós prod restoration.

**DoD G/W/T S201 (code-only):**
- G1: `cesta-web/tests/e2e/auth.spec.ts` — flows: (a) register → form validation + submit → auto-login redirect home; (b) logout → session cleared → /favoritos redirects /login; (c) login existing user → session persist (reload mantém logged); (d) i18n toggle não invalida session (regression S168 P1 fixed).
- G2: Test fixtures: mock backend responses via Playwright route interception OR hit real cesta-api local (docker-compose up). Dev escolhe + justifica PR body.
- G3: Playwright trace on-failure preservado (S198 pattern). Timing retry se cesta-api local lento boot.
- G4: CI workflow `.github/workflows/e2e.yml` roda auth.spec além home.spec. Upload traces artifact.
- G5: README Playwright E2E section update (auth flows docs).

**Scope S201:** E2E regression expansion. Zero prod touch. Base pra S202+ more flows (favoritos, comparar, minha-lista).

**Branch:** feat/sprint-201-e2e-auth-flow.

**Contexto Boss:** S188-S199 shipped prod restoration readiness + quality gates stack completa (coverage/i18n/a11y/E2E/bundle). Loop autônomo 11 sprints desde prod suspension. S200 = marco sprint — audit/consolidate estado + CHANGELOG backfill S101-S199 via git log (memory feedback-changelog-anti-hallucination strict).

**DoD G/W/T S200 (code-only):**
- G1: `scripts/changelog-backfill.mjs` — ler git log entre tag/S100 e HEAD, extract commits SHA + message, group por sprint (regex pattern `sprint N` ou `Sprint N` ou `#PR` cross-ref). Output markdown table.
- G2: CHANGELOG.md append section `## [Unreleased] — Sprints 101-199` com entries agrupadas por sprint + SHA inline per claim (anti-hallucination compliance).
- G3: Audit state: rodar coverage + i18n-parity + a11y-audit + bundle-size locally (ou CI). Capturar output JSON em docs/audit-s200.md como snapshot MARCO.
- G4: ADR 0020 docs/adr/0020-sprint-200-marco.md — consolidate learnings loop autônomo (sprints shipped, patterns, deferred bugs).
- G5: CI verde (coverage+i18n+a11y+bundle+e2e nightly).

**Scope S200:** marco consolidation. Zero prod touch. Snapshot estado pré prod restoration.

**Branch:** chore/sprint-200-marco-consolidate.

**Contexto:** S194 coverage + S196 i18n + S197 a11y + S198 E2E completaram quality gates básicas. S199 adiciona bundle size enforcement: measure Next.js build output + CI falha se cresce além threshold. Frontend perf ADR 0019 baseline.

**DoD G/W/T S199 (code-only):**
- G1: Script `cesta-web/scripts/bundle-size.mjs` — pos-build .next, somar sizes por route (First Load JS + per-page bundles). Output JSON + markdown table.
- G2: Config threshold baseline (ex First Load JS ≤ 200KB gzip, per-page ≤ 50KB) — Dev justifica PR body sensato sem burn-in.
- G3: CI step `.github/workflows/ci.yml` roda bundle-size pós web build + falha se cresce >10% vs baseline OR acima absolute threshold.
- G4: Vitest spec script util (mock Next output + verify threshold logic).
- G5: ADR 0019 docs/adr/0019-bundle-size-baseline.md + README Bundle Size section.

**Scope S199:** CI perf quality gate. Zero prod touch. Previne bundle bloat silencioso.

**Branch:** feat/sprint-199-bundle-size-gate.

**Contexto:** Testes atuais são jest/vitest unit+integration. E2E ausente. Prod restoration readiness smoke-test-prod.ts hits endpoints HTTP mas não valida user flows browser. S198 estabelece Playwright foundation — primeiro smoke test home + search. Base pra E2E regression suite pós prod.

**DoD G/W/T S198 (code-only):**
- G1: `cesta-web/package.json` + `playwright.config.ts` — install Playwright + chromium browser + config headless + baseURL env-aware (dev vs preview).
- G2: `cesta-web/tests/e2e/home.spec.ts` — primeiro smoke: /home carrega, search input visível, type "leche", dropdown suggestion aparece. Playwright trace on-failure.
- G3: `.github/workflows/ci.yml` CI job separado `e2e` (optional — pode ser nightly se ficar lento). Install browsers + run tests + upload Playwright report artifact.
- G4: `.gitignore` Playwright caches + output dirs.
- G5: README Playwright E2E section + como rodar local.

**Scope S198:** foundation E2E. Zero prod touch. Base pra S199+ expand E2E coverage após prod.

**Branch:** feat/sprint-198-playwright-e2e-setup.

**Contexto:** S194 coverage + S196 i18n estabeleceram pattern CI quality gates. S197 estende accessibility: axe-core via puppeteer/cli contra Next.js preview build. Captura violations critical/serious + CI falha abaixo threshold.

**DoD G/W/T S197 (code-only):**
- G1: Script `cesta-web/scripts/a11y-audit.mjs` — spawn Next.js build + serve local + roda axe-core contra rotas principais (/, /produto/[pid], /comparar, /favoritos, /login, /perfil). Output JSON violations por rota.
- G2: Config threshold (ex zero critical + ≤5 serious baseline) — Dev justifica PR body sem burn-in alto demais.
- G3: CI step `.github/workflows/ci.yml` roda a11y-audit pós build + falha se acima threshold. Separar do test step.
- G4: Vitest spec script util (mock axe-core output + verify threshold logic).
- G5: README Accessibility section + regen baseline procedure.

**Scope S197:** CI a11y quality gate. Zero prod touch. Captura GDPR adjacent issues (keyboard nav, ARIA labels, contrast).

**Branch:** feat/sprint-197-a11y-audit-gate.

**Contexto:** Loop S26-S192 cresceu i18n (73→183+ chaves paridade registered). Sem script contínuo, drift silenciosa possível. S196 estabelece baseline script + CI check + fill gaps.

**DoD G/W/T S196 (code-only):**
- G1: Script `cesta-web/scripts/i18n-parity.mjs` — lê `messages/es.json` + `messages/pt-BR.json`, reporta keys missing em cada lado + nested paths incompletos.
- G2: Rodar script atual. Capturar drift (keys only ES / keys only PT-BR / nested paths parciais). PR body report.
- G3: Fill gaps — adicionar translations missing (Dev usa pattern linguístico existente namespace). Se ambíguo, marcar `TODO:` com context.
- G4: CI step `.github/workflows/ci.yml` roda i18n-parity + falha se drift. Separar do step test.
- G5: README section i18n parity enforcement + manual regen procedure.

**Scope S196:** i18n quality gate. Zero prod touch. Previne drift future sprints.

**Branch:** feat/sprint-196-i18n-parity-audit.

**Contexto:** Loop acumulou ~20+ sprints desde último dependency audit. Vulnerabilities CVE podem acumular silenciosamente. S195 roda `npm audit` em cesta-api + cesta-web + ops/, aplica patches minor/patch sem breaking + documenta deferred major bumps.

**DoD G/W/T S195 (code-only):**
- G1: Rodar `npm audit --production --json` em cesta-api + cesta-web + ops/. Capturar vulnerabilities HIGH/CRITICAL em PR body.
- G2: `npm audit fix` aplicar patches automáticos (minor/patch semver safe). Verificar diff package-lock.json sensato.
- G3: Manual review patches major bumps requeridos: Dev documenta em PR body deferred por breaking risk + cria GH issue tracking cada.
- G4: CI verde api+web pós-upgrades + specs passam zero regression + coverage threshold S194 holds.
- G5: Doc README section Security audit procedure + schedule periódico.

**Scope S195:** security maintenance. Zero prod touch. Nunca force major bumps sem review.

**Branch:** chore/sprint-195-npm-audit-sweep.

**Contexto:** S188-S193 shipped prod restoration readiness + observability + nits backlog. Base de testes cresceu (jest ~500 api + vitest ~200+ web). Sem threshold, cobertura pode drift down silenciosa. S194 estabelece baseline + CI gate falha se drop.

**DoD G/W/T S194 (code-only):**
- G1: Rodar jest api + vitest web com `--coverage` localmente. Capturar statements/branches/functions/lines %.
- G2: Config `cesta-api/jest.config.js` + `cesta-web/vitest.config.ts` com `coverageThreshold` floor no baseline atual (ex 80% stmt se baseline=85%). Dev justifica baseline PR body (não burn-in alto demais blocking futuras mudanças).
- G3: CI workflow `.github/workflows/ci.yml` roda coverage + falha se abaixo threshold. Separar step coverage do step test (clareza logs).
- G4: Artifact upload coverage reports no CI (step opcional + ignore no PR body se não valer).
- G5: Doc README section Coverage threshold + como regenerar baseline.

**Scope S194:** CI quality gate expansion. Zero prod touch. Previne regression future sprints.

**Branch:** feat/sprint-194-coverage-threshold-gate.

**Contexto:** S71 shipped cold-start resilience + Reviewer deslocou 4 nits pro backlog. 2 ja fechados por sprints posteriores (retry sem breadcrumb = S188+S191). 2 restam: /health shallow sem Prisma check + hardcoded hex color page.tsx + ECONNRESET implicito handling. S193 closes long-standing nit backlog.

**DoD G/W/T S193 (code-only):**
- G1: `/health` endpoint deep check. Expand `cesta-api/src/modules/health/health.service.ts` pra verificar Prisma (SELECT 1) + Redis (PING). Retorna 200 só se todos healthy; 503 com payload {prisma:ok|fail, redis:ok|fail} se qualquer um falhar. Mantém `/health` como liveness shallow? OU split: /health (liveness shallow) + `/ready` (readiness deep). Dev escolhe + justifica PR body (preferência split pra K8s/Render compatibility).
- G2: Hardcoded hex color `page.tsx:252` (ou arquivo atual onde #1b6b48 persiste) → migrar pra token Tailwind design system (cesta-identidade-visual.md). Grep rápido pra identificar outras instâncias #1b6b48 e migrar todas.
- G3: ECONNRESET handling adapters/HTTP clients. Audit catch blocks que podem ECONNRESET silenciar. Documentar em ADR 0018 se vale. OR adicionar retry explícito pattern (withRetry S189 integra?).
- G4: Jest spec health novos casos (prisma fail / redis fail / both fail / all ok). Vitest regression se afeta frontend.
- G5: CI verde + audit:repos+dtos. Vault defer empirical.

**Scope S193:** fechamento backlog S71 longa data. Zero prod touch.

**Branch:** feat/sprint-193-close-s71-nit-backlog.

**Contexto:** S191 instrumentou 3 processors (alerts, catalog-sync, receipts) com processor-observability util + Sentry breadcrumbs. Notifications processor ainda não tem. S192 completa cobertura backend workers + adiciona frontend Sentry breadcrumbs em critical UX paths (fuzzy suggest, catalog fetch, login).

**DoD G/W/T S192 (code-only):**
- G1: `cesta-api/src/modules/notifications/notifications.processor.ts` — instrumentar com processor-observability util (S191 pattern). Se não existe processor file, documentar PR body + skip G1.
- G2: Frontend Sentry breadcrumbs — `cesta-web/src/js/lib/sentry.ts` (OR existing sentry setup) adicionar breadcrumb emitters pra: (a) `/products/suggest` request start/success/failure, (b) `/products` fetch por rota, (c) login/register attempts com outcome. Payload sem PII (data-sentry-mask pattern GDPR S59).
- G3: Jest spec notifications.processor novo caso (se G1 aplicável). Vitest spec frontend sentry breadcrumbs mock sentry.addBreadcrumb + verify payload sem PII.
- G4: CI verde api+web + audit:repos+dtos pass + GDPR mask check (sem user data em breadcrumbs).
- G5: Vault pendente defer empirical continue.

**Scope S192:** completa BullMQ observability + estende Sentry pro frontend. Zero prod touch. GDPR-safe (no PII em breadcrumbs).

**Branch:** feat/sprint-192-notifications-frontend-sentry.

**Contexto:** S188 Sentry breadcrumb migrate deploy chain ADR 0013. S189 criou withRetry util. S190 revalidate consumiu. S191 estende pattern BullMQ workers: processors de catalog-sync, receipts (OCR), notifications. Sentry breadcrumbs attempt-level + retry via withRetry onde faz sentido.

**DoD G/W/T S191 (code-only, observability + refactor):**
- G1: Identificar BullMQ worker error retry patterns em: `cesta-api/src/modules/catalog-sync/catalog-sync.processor.ts`, `cesta-api/src/modules/receipts/receipts.processor.ts`, `notifications.processor.ts`. Listar em PR body (with retry OU without).
- G2: Sentry breadcrumb enhancement — processor events (job start, job error with attempt_number, job retry scheduled, job final fail). Payload inclui jobId, name, attemptsMade, data snapshot.
- G3: Se worker tem retry logic custom → migrar pra withRetry util (same pattern revalidate S190); caso contrário documentar BullMQ default retry config (attempts/backoff em queue options).
- G4: Jest spec processor novo caso (mock sentry.addBreadcrumb + verify payload). Audit:repos+dtos pass.
- G5: CI verde api+web. Vault pendente defer empirical.

**Scope S191:** continuidade observability+refactor. Zero prod touch. Pattern S188+S189+S190 estendido pra workers.

**Branch:** feat/sprint-191-bullmq-worker-observability.

**Contexto:** S189 criou `cesta-api/src/common/utils/retry.ts` + spec. Reviewer gate 3 AJUSTE pós-auto-merge: `ops/smoke-test-prod.lib.ts:L95` `checkAuthHealth` bate `/auth/health` inexistente (auth.controller só tem `@Get(\"me\")`). Fix-forward PR do main. S190 bundle AJUSTE + adapter retry refactor.

**DoD G/W/T S190 (code-only, refactor):**
- G0: S189 AJUSTE auth-health. Dev escolhe opt (a) criar endpoint `@Get(\"health\")` em auth.controller.ts que retorna 200 + JWT seeds sem auth required; OU opt (b) remover `checkAuthHealth` de smoke-test-prod.lib.ts. Opt (a) preferida (matches smoke contract pós-restoration). Justifica escolha PR body.
- G1: Identificar adapters com retry logic duplicada: `cesta-api/src/modules/catalog-sync/adapters/*` (polite-fetch, ScrapingBee) + BullMQ worker error retry paths. Listar em comentário PR.
- G2: Refactor cada site pra usar `withRetry(fn, {attempts, backoffMs, onAttempt})` do S189. Preservar attempts/backoffMs valores atuais.
- G3: Jest specs existentes (polite-fetch.spec, adapter specs) devem passar sem mudança — comportamento idêntico. Vitest smoke pass.
- G4: CI verde api+web. Audit:repos + audit:dtos pass.
- G5: Vault pendente.md defer empirical continue.

**Scope S190:** DRY cleanup. Zero prod touch. Zero feature. Reduz boilerplate + codebase cohesion pós-S189 util.

**Branch:** refactor/sprint-190-adapters-retry-migrate.

**Contexto Boss:** prod suspended ongoing (USER decide path). S188 shipped smoke-test base + ADR 0017 playbook + Sentry breadcrumb migrate. S189 amplia smoke coverage pra chegada prod restoration mais robusto + DRY retry across adapters.

**DoD G/W/T S189 (code-only):**
- G1: `ops/smoke-test-prod.ts` expand coverage: adicionar seções (a) `/products/suggest?q=lecge/yogrt/yoguer` fuzzy chain determinism check (3-runs cada), (b) `/products?supermarket=<slug>` por super (Mercadona/DIA/Eroski/Froiz/Aldi/LIDL/Carrefour) com thresholds mínimos, (c) `/auth/health` endpoint smoke.
- G2: Shared retry utility `cesta-api/src/common/retry.ts` — extract retry logic de ADR 0013 (migrate) + adapters existentes (polite-fetch retry, ScrapingBee retry se existe) numa função `withRetry(fn, {attempts, backoffMs, onAttempt})`. Dry: adapters consomem shared util.
- G3: Jest spec `retry.spec.ts` (attempts, backoff timing, onAttempt callback, abort, error propagate).
- G4: Vitest spec expand pra smoke-test-prod (novos thresholds mock).
- G5: Vault pendente.md continua defer empirical ate prod restored.

**Scope S189:** continuidade S188 preparedness. Zero prod touch. Reduz boilerplate + amplia regression safety net.

**Branch:** feat/sprint-189-smoke-expand-retry-util.

**Contexto Boss:** prod suspended billing (free tier Nov esgotou). USER decide (upgrade / wait Dec1 reset / Fly.io migrate). Manager+Dev zero touch prod. S188 prepara ferramentas pra quando prod volta (automated validation + observability pra reduzir MTTD futura).

**DoD G/W/T S188 (code-only):**
- G1: `ops/smoke-test-prod.ts` script Node — automated regression S179-S187 pós prod restoration. Valida: /health 200, /api/v1/products count ≥ 8500, 6 supers ativos (Mercadona + DIA + Eroski + Froiz + Aldi + LIDL + Carrefour frozen), fuzzy chain (lecge/yogrt/yoguer baseline leche/yogur determinístico 3-runs), imageUrl % ≥ 70. Output pass/fail por seção + exit code.
- G2: Sentry breadcrumb enhancement — ADR 0013 retry logic (migrate deploy retry 3x backoff) emite breadcrumb por attempt com `attempt_number`, `error_code`, `backoff_ms`. Melhora observabilidade futura P1002 recurrence.
- G3: Vitest spec pra smoke script util (mock responses + validate thresholds). CI verde.
- G4: ADR 0017 `docs/adr/0017-prod-restoration-playbook.md` — procedure pós-restoration (rodar smoke, validar metrics, re-enable crons, Sentry health check). Trade-offs 3 opts Boss escalou.
- G5: Vault pendente.md entry defer empirical validation ate prod restored (manter).

**Scope S188:** preparedness. Zero prod touch. Reduz tempo recovery quando USER decidir prod path.

**Branch:** feat/sprint-188-prod-restoration-readiness.

**Contexto Boss prod suspended:** cesta-gsvc.onrender.com HTTP 503 "service suspended by its owner" desde 12:55Z. Hipótese provável: free tier 750h/mês esgotou fim Nov. Boss decidindo opção (a) aguarda reset mês / (b) upgrade $7 VETO / (c) Fly.io migrate / (d) check manual suspension. S187 ship pure code (CI/vitest/jest), empírico fica pendente vault pendente.md até prod restored.

**DoD G/W/T S187 (code-only, sem empírico até prod volta):**
- G1: S185 nits P3 — (a) jest spec SQL rerank mock + score computation validation (não só pass-through); (b) boost cumulativo cap 1.0 ceiling.
- G2: S186 nits P3 — (a) extract const `MAX_PRICE_BLOCK_BYTES = 2000` com docstring ReDoS + LIDL payload empírico; (b) criar GH issue "LIDL: migrate from regex to JSON parser" pra follow-up pós-MVP.
- G3: Rolling nits backlog memory `project-sprint-109-backlog` (2026-11-19): cast guard + $transaction patterns + brand parsing + spec default wh + AUTO_SYNC_ON_BOOT parse robustez + hook test. Dev prioriza high-value + registra deferrals vault.
- G4: CI verde api+web + vitest/jest all pass (no regression).
- G5: Sprint deferred empirical validation entry vault pendente.md (sem prod empírico até service restored).

**Scope S187:** code quality cleanup. Zero mudança funcional usuário visível. Mantém velocidade loop enquanto Boss resolve prod suspension.

**Branch:** chore/sprint-187-nits-cleanup-bundle.

**Contexto Boss MVP-first (memory feedback-loop-metric-shift):** loop mede produtos reais prod + % fotos + supermercados ativos. Estado prod 12:16Z: Mercadona ~4000+ / DIA 2945+ / Eroski 746 ✅ / Froiz 366 ✅ / Aldi ~145 / **LIDL 41 ⚠️** / Carrefour 27 (Akamai pós-MVP) / Froiz grew. LIDL é bottleneck atual MVP catalog.

**Histórico LIDL:** S126 adapter ativo t+38min yield 37 produtos (seed 27 +10). Hipóteses não-validadas: SEED_QUERIES incompletas prod, regex parser missing hits, politeFetch rate-limit cortou run cedo. Probe local sugeriu ~3800 potenciais.

**DoD G/W/T S186:**
- G1: Investigar root cause LIDL yield baixo (SEED_QUERIES prod atual vs código; regex parser audit em HTML sample; rate-limit politeFetch config).
- G2: Fix + commit. Opções: (a) expand SEED_QUERIES; (b) ajustar regex parser; (c) relaxar rate-limit se LIDL CDN permite; Dev escolhe + justifica ADR 0016 docs/adr/0016-lidl-adapter-yield.md.
- G3: Trigger manual-sync LIDL pós-deploy. Target empírico ≥200 produtos prod (5x current 41).
- G4: CI verde api+web. Vitest regression se adapter test file existir.
- G5: Smoke prod `/products?supermarket=lidl` total ≥200. ImageUrl presente em maioria (regression S133 blob pipeline não quebra).

**Scope S186:** $0 stack compatible (LIDL permite fetch direto, sem ScrapingBee). Close catalog MVP bloqueio LIDL. Mantém Eroski 746 + Froiz 366 + Aldi 145 + crons Mercadona/DIA working.

**Branch:** feat/sprint-186-lidl-yield-fix.

**Contexto Boss:** P1002 = timeout advisory lock/conexão no migrate deploy. Estrutural, não transient. Build Render falha pre-start; retry manual via API restaura mas não resolve raiz.

**DoD G/W/T S183 (Boss-defined):**
- G1: schema.prisma directUrl = Neon NON-pooled (sem -pooler) pro migrate (via DATABASE_URL_UNPOOLED env Render). Migrate connecta direto Neon, bypass pgbouncer connection ceiling.
- G2: connect_timeout=30 na DATABASE_URL_UNPOOLED (query param) — ampliar window retry conexão.
- G3: build script (package.json 'build' ou render-build.sh) migrate deploy com retry 3x backoff 10s/20s/40s exponencial. Pattern: npx prisma migrate deploy || sleep 10 && retry || sleep 20 && retry || sleep 40 && retry || exit 1.
- G4: ADR 0013 docs/adr/0013-prisma-neon-deploy-resilience.md curta (problema P1002 x4, root cause pgbouncer+pooler timeouts, fix directUrl+timeout+retry, trade-offs).
- G5: CI verde api+web. Validate Render API deploy sem falha migrate (dry-run via Render API trigger OR aguarda próxima sprint natural trigger).

**Scope S183:** zero mudança funcional. Infra deploy resilience. Pattern estrutural fix. Fecha ciclo pós-S182 Chain.

**Branch:** fix/sprint-183-prisma-neon-deploy-resilience.

## Histórico (S170+)

Snapshots: S170-S204 → `docs/archive/sprints-note-2026-11-26.md`. S205-S224 → `docs/archive/sprints-note-2026-11-27.md`. Entries abaixo são S225+ (append aqui conforme fechamento).

- **S225** PR #191 gates 3+4 ✅ (MERGED 12:16:17Z HEAD 4d830c4) — Fotos Aldi+LIDL + G0 archive Histórico Sprints (MVP Bloco 2 · Boss 2026-11-27 · ADR 0033). G0 ✅ archive docs/archive/sprints-note-2026-11-27.md (S205-S224 snapshot · 41.7KB→<10KB) + ponteiro nota Sprints. G1 baseline Aldi 89.6% + LIDL 81.7% below 95% confirmado. G2 root cause: adapters Aldi+LIDL extraem imageUrl OK (post-S224 sourceImageUrl) · gap é cron schedule missing (manual trigger only). G3 FIX: catalog-sync.schedule.ts + processor daily cron 03 UTC Aldi+LIDL (reusa pattern Mercadona/DIA). ADR 0033 (90L). Spec schedule 5/5 ✅. Jest + audit:dtos+repos ✅ · CI 4/4 ✅. Gate 3 ✅ Gate 4 ✅ code-only zero UX regression prod (Web desktop + Mobile 390x844 · search + detail · console clean). G4 empírico ≥95% Aldi+LIDL deferred D+2 2026-11-29 07:00 CET (precisa 2 ciclos cron noturno). 3 Reviewer nits non-blocker: pnpm comment stale (npm projeto) · activeSchedule identity wrapper S214 nit · scripts/sync-*.ts não populam sourceImageUrl (ADR L90-91 reconhece follow-up).
