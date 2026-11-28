# Cesta — Pendente

> QA findings aguardando resolução. Append-only por data.

## Bugs QA (2026-11-19)

**Alvo:** PR #69 / Sprint 119 — Carrefour adapter ativo + bootstrap multi-slug
**Merge SHA:** f6a5bbe (2026-11-19T17:08:43Z, auto-merge)
**Target:** prod `https://cesta-gsvc.onrender.com/api/v1`

### DoD verification (verificação empírica prod)

- **DoD #1** `GET /products?supermarket=carrefour` ≥ 500 produtos → **FAIL** (total reportado: **27**)
- **DoD #2** Distinct supermarkets em `/products` ≥ 2 → **PASS** (7 slugs com produto via filter: mercadona 4006 / carrefour 27 / alcampo 27 / aldi 27 / dia 27 / froiz 27 / lidl 27)
- **DoD #3** `/admin/catalog-sync/runs?supermarket=carrefour` success/partial → **UNVERIFIED** (HTTP 401 "Token ausente"; QA sem token admin prod)

### Smoking gun

Todos os supermarkets não-mercadona reportam **exatamente 27 produtos** — mesmo valor histórico dos seeds demo (lidl/alcampo/dia/froiz/aldi pré-S119). **Carrefour adapter não populou catálogo em prod** após merge+deploy. Scan 2min após deploy flat em 27 → não é deploy em curso, é adapter silenciado.

Hipóteses (Dev investigar):
- Env `AUTO_SYNC_ON_BOOT_SLUGS=mercadona,carrefour` + `AUTO_SYNC_ON_BOOT=true` não setados em Render prod
- Akamai bloqueou (free tier shared IP) → run marcou `failed`/`partial` sem produtos
- `bootstrap-sync` enfileirou mas worker Carrefour falhou silencioso (log pra inspecionar)

### Bugs (REPROVA)

- S119 [P0] `GET /api/v1/products?supermarket=carrefour` → total=27, DoD exige ≥500; Carrefour adapter não populou em prod
- S119 [P1] `/api/v1/admin/catalog-sync/runs` → HTTP 401 "Token ausente"; sem rota/token documentado pra QA verificar status de run

### Evidência

```
curl /api/v1/products?supermarket=carrefour&limit=1
→ {"meta":{"pagination":{"page":1,"limit":1,"total":27,"totalPages":27}}}

curl /api/v1/supermarkets → 7 markets (alcampo, aldi, carrefour, dia, froiz, lidl, mercadona)
curl /api/v1/products?supermarket=mercadona → total 4006
curl /api/v1/products?supermarket=carrefour → total 27
curl /api/v1/products?supermarket=lidl      → total 27
curl /api/v1/products?supermarket=alcampo   → total 27
curl /api/v1/products?supermarket=dia       → total 27
```

**Veredito:** REPROVADO — DoD #1 não atendido. Dev investiga env/Akamai/worker.

### Reteste pós-pedido Dev (2026-11-19 17:16Z→17:46Z)

Dev pediu reteste em ~20-25min citando worker concurrency=1 processando Mercadona primeiro + Carrefour ETA 17:30-45Z.

Poll 60s intervalo, 30 iterações cobrindo janela completa pós-ETA:

```
[t+1s]    carrefour total: 27
[t+61s]   carrefour total: 27
...
[t+1762s] carrefour total: 27   ← t=29.4min, ETA +16-31min passou
```

**30/30 polls flat em 27.** Adapter não populou. Mercadona (4621 prods) processaria em <5min concurrency=1 — se Mercadona tivesse bloqueado fila, teria crescido também. Mercadona já está em 4006 estável → fila já drenou, Carrefour deveria ter rodado e não rodou (ou falhou silencioso).

**Reveredito:** REPROVADO reafirmado. Dev debug env Render + logs worker Carrefour.

---

## Resolução S119→S122 (2026-11-19 19:21Z)

Timeline:
- **S119** PR#69 Carrefour adapter ativo — carrefour=27 flat 30min+ (adapter rodando mas 403 Akamai)
- **S119-fix** PR#70 worker concurrency 1→3 — carrefour=27 flat 45min (concurrency não era root cause)
- **S120** PR#71 anti-bot warmup+cookie session — carrefour=27 flat 45min (Akamai _abck exige JS challenge, bypass fetch insuficiente)
- **S121** PR#72 pivot bootstrap mercadona→dia — dia=27 flat (adapter DIA usava endpoint 404)
- **S122** PR#73 DIA real endpoint `/api/v1/search-back/search` + parser real shape — **dia=522 em t+32min** ✅

**DoD final S122:**
- `/products?supermarket=dia` ≥ 500 → **PASS** (522 populate, 649 estável pós)
- Distinct supermarkets ≥ 2 → **PASS** (mercadona 4008 + dia 522)
- Logs `DIA: N produtos coletados` N > 500 → inferido via total prod endpoint

**Carrefour backlog** → Puppeteer+stealth fase 2 (Akamai bot manager não bypassa via fetch).

**Veredito:** APROVADO. S122 FECHADA.

---

## S124→S127 Catalog diversificação (2026-11-19)

Timeline:
- **S124** PR#74 EroskiAdapter sitemap scraping — eroski=0 flat 60min deadline (Eroski CDN filtra headers XHR-like datacenter)
- **S125** PR#75 Eroski sitemap bareFetch fix — eroski=0 flat 60min deadline, fix não resolveu empiricamente (CDN mais restritivo que probe local sugeriu)
- **S126** PR#76 LIDL adapter ativo — lidl=37 (seed 27 → +10) flat t+38min, DoD ≥300 em observação
- **S127** PR#77 Aldi adapter real — aldi=27→**145** em t+3.6min ✅

**Estado prod atual (2026-11-19 21:30Z):**
- Mercadona 4008 ✅
- DIA 2945 (crescendo) ✅
- Aldi 145 ✅
- LIDL 37 ⚠️ (adapter rodou mas pouco yield)
- Eroski 0 ❌ (CDN block)
- Carrefour 27 ❌ (Akamai, Puppeteer backlog)
- Froiz 27 ❌ (não é loja online, só folleto visual)

**4 supermarkets funcionais prod. 7135 produtos total.**

### S131 /comparar matrix (2026-11-19 23:41Z)

PR#81 merged. Portal test com 2 produtos seed (7 markets cada):
- Tabs Precios/Tabla/Nutrición ✅
- Matrix 2×7 ✅
- Ordenação asc avg price ✅ (Aldi<LIDL<Mercadona<DIA<Alcampo<Carrefour<Froiz)
- Cheapest cell verde ✅ (coluna Aldi)
- Mobile viewport 390x844 overflow-x-auto ✅

APROVADO.

### S126 LIDL poll final (2026-11-19)

Poll DEADLINE 60min: lidl=37 flat. DoD ≥300 **FAIL**. Adapter rodou (seed 27 → 37 = +10 produtos coletados) mas yield muito baixo vs probe local (~3800 potenciais). Hipóteses: SEED_QUERIES incompletas em prod, regex parser missing hits, rate-limit politeFetch cortou run cedo. Dev backlog follow-up S128+.

### S164 /favoritos page polish (2026-11-25 12:50Z) APROVADO ✅

PR #120 merged. Deploy 21b7905 LIVE 2026-11-25T12:50:13Z.

**DoD G1-G5 todos met empírico prod:**
- G1 Grid + count badge sempre visível ("Mis favoritos· 3 productos"; atualiza instant pós unfavorite 3→2)
- G2 Empty state premium ("Aún no tienes favoritos" + CTA "Explorar productos")
- G3 Unfavorite optimistic (ConfirmDialog "¿Quitar este producto de tus favoritos?" + Cancelar/Confirmar; card some instant)
- G4 i18n ES + PT-BR ("Meus favoritos· N produtos" plural ICU; "Sem glúten/Sem lactose/Preço total/em Eroski")
- G5 Vitest regression 189/189 (+2 favorites-empty-state.spec)

**Follow-up P3 queued (branch fix/sprint-164-gdpr-mask):**
- GDPR mask /favoritos page: cards renderizam nomes produtos do user (lista pessoal = PII contextual) sem `data-sentry-mask`. Session Replay pode vazar quais produtos user curtiu.
- Heart token nit: coral Heart icon empty state usa hex inline em vez de token Tailwind design system.


### S165 unit price display global (2026-11-25 18:44Z) APROVADO ✅

PR #121 merged. Deploy 161f177 LIVE 2026-11-25T18:44:05Z.

**DoD G1-G5 empírico prod:**
- G1 ProductCard secondary line block layout (primary <p> + secondary <p> mt-1 text-xs text-muted)
- G2 UNIT comparisonUnit → sem secondary (vitest coverage)
- G3 Home grid '4,33 €/kg', '2,16 €/kg', '7,18 €/kg' + /favoritos Cordero EROSKI '24,95 €/kg' + /minha-lista Barritas '15,38 €/kg' + Arroz Dia '10,00 €/kg'
- G4 calcUnitPrice 13/13 vitest (LITER/KILOGRAM/GRAM/MILLILITER/UNIT + edges 0/null/negativo/NaN/Infinity + arredondamento)
- G5 i18n ES+PT-BR locale-aware via formatUnitPrice S118 (comma decimal, suffix backend)

Vitest 207/207 (+18). Zero backend touch. Core UVP cesta.md §3.2 shipped global.

### S166 PR #122 1ba6d62 (2026-11-25 18:54Z) APROVADO ✅ (S164 follow-up)

PR #122 merged 2026-11-25T18:54:15Z. Deploy LIVE.

**DoD G1-G4 empírico prod:**
- G1 /favoritos logged `<ul data-testid="favorites-list" data-sentry-mask>` presente, 2 cards child ✅ (GDPR PII lista pessoal mascarada Session Replay)
- G2 FavoritesEmptyState Heart `lucide lucide-heart h-8 w-8 text-cesta-green` ✅ (brand primary token, coral removido afetivo→destrutivo semantic swap)
- G3 S164 features intact (count badge '· 2 productos' + filters Vegano/Vegetariano/Sin gluten/Sin lactosa + Nutri-Score + Compare + sort Precio total/Precio por unidad preservados)
- G4 Vitest regression favorites-gdpr.spec.ts 2/2 passing

Vitest 209/209 (+2). Zero backend touch. GDPR compliance Sprint 59 CLAUDE.md §GDPR/Privacy + cesta-identidade-visual.md §3.3 Coral semantic reservado.


## S168 Smoke-test prod bugs audit (2026-11-25)

Executado audit empírico prod 9 rotas principais (anon + logged QA user + edge cases). Prod HEAD = S167 AJUSTE (439080ea).

### Bugs encontrados (priority desc)

**P1 — [HIGH] /comparar anon sem produto renderiza EMPTY**
- Rota: `https://cesta-web.vercel.app/comparar`
- Ação: navegar direct sem `?productId=`
- Esperado: empty state premium "Añade productos para comparar" + CTA explorar ou buscar
- Obtido: `<main>` vazio (len=0). Só banner "Confirma tu email" visível topo. User chega → tela em branco → não entende como adicionar produtos
- Repro: portal navigate → snapshot: só banner email + alert[-1,-1]
- Fix suggest: `ComparePage` render `<ComparisonEmptyState>` quando `productIds.length === 0`

**P1 — [HIGH] /perfil toggle Português (BR) desloga user**
- Rota: `https://cesta-web.vercel.app/perfil`
- Ação: logged QA user clica button "Português (BR)" (lang toggle)
- Esperado: UI troca pra PT-BR mantendo session
- Obtido: redirect `/login?returnUrl=/perfil` + session invalidada (user precisa re-login)
- Repro: login QA → /perfil → click Português (BR) → URL vira login
- Fix suggest: inspecionar handler lang toggle — possível `router.replace` + locale cookie troca cookie auth OR middleware route guard valida locale cookie contra token

**P3 — [LOW] /produto PDP cold start stuck skeleton**
- Rota: `/produto/[pid]` após Render spin-down
- Ação: navegar direct PDP pós 15min idle
- Esperado: skeleton loader + reveal conteúdo em <30s (cold start Render free)
- Obtido: skeleton loader visível, `document.body.innerText.length=0` por tempo estendido. Pode ser Render cold start normal (não bug), apenas registrado pra observação. Pós-reload resolve
- Prioridade baixa (comportamento conhecido Render free tier)

**P3 — [LOW] /perfil Cerrar sesión exige scroll**
- Rota: `/perfil`
- Ação: user procura logout
- Esperado: botão visível acima da dobra OR seção dedicada visível
- Obtido: botão `Cerrar sesión` fica após scroll ~1000px (depois de Mis atalhos). Acessível mas discoverability baixa
- Prioridade baixa (polish UX)

### Rotas validadas sem bugs

- ✅ `/` home: 30 cards grid + FeaturedDeals section "Mejores ofertas" + chips categoria + search typeahead combobox
- ✅ `/produto/[pid]` (Aceite girasol Hacendado): H1 + 2 DiscountBadges -78% + pkgPill "5L" + 6 price rows
- ✅ `/alertas`: empty state "Crea una alerta..." + CTA "Crear mi primera alerta" + section REGLAS COMBO/TREND/BUNDLE separada
- ✅ `/alertas/novo`: 3 opções wizard (Combo/Trend/Bundle) renderizam
- ✅ `/favoritos`: logged 2 favs + `<ul data-sentry-mask data-testid="favorites-list">` GDPR S166 + count badge "· 2 productos" + unit price "24,95 €/kg" secondary S165
- ✅ `/minha-lista`: lista "QA S163 test" 2 produtos renderiza (desde 1,00 €)
- ✅ `/minha-cesta`: empty state "Aún no tienes cesta" + CTA "Configurar perfil"
- ✅ `/gastos`: empty state "Aún no tienes tickets" + CTA "Escanear ticket"
- ✅ `/perfil`: Mi cuenta + email + idioma toggle + restricciones dietéticas + preferencias visualización + 2FA button + Exportar/Eliminar + atalhos + Cerrar sesión (pós scroll)

### DoD G/W/T
- G1 ✅ 9 rotas smoke-test executado empírico prod (anon + logged + edges)
- G2 ✅ Vault pendente.md section S168 registered bugs priority desc
- G3 ⚠️ 2 bugs P1 encontrados (não P0 crítico mas HIGH UX impact pra Manager publicar fix)
- G4 ✅ Bugs P3 backlog ordenado

**Recomendação Manager:** S169 fix bundle pros 2 P1 (/comparar empty state + /perfil lang toggle session). S170+ polish Bloco 4.

---

## S182 nit P3 (2026-11-26 — PR #139)

**Escopo:** rerank boost first-word direct-match fuzzy search.

### Gate 4 ⚠️ APROVADO PARCIAL 4/5 empírico prod

- `q='lecge'` → top1 **'Lechuga del País Vasco'**, Leche só #2 ❌ G1 FAIL
- `q='yogrt'` → 'Yogur líquido piña y coco' top ✅
- `q='yoguer'` → 'Yogur natural 4x125g' top ✅
- `q='leche'` baseline → Leche top ✅
- `q='yogur'` baseline → Yogur top ✅

### Root cause P3

- `lecge` trigrams: `lec/ecg/cge` — 'Leche' (`lec/ech/che`) compartilha `lec` (1 match); 'Lechuga' (`lec/ech/chu/hug/uga`) compartilha `lec` também (1 match) mas tem +4 trigrams totais → trigram similarity dilution favor 'Lechuga' (menor denominador = maior ratio)
- LIKE prefix `lec%` → ambos match; empate
- First-word boost rerank aplica igual: ambos primeira palavra starts com 'lec'
- Resultado: trigram inflation 'lechuga' ganha empate

### Fix options S185 backlog

- **A (preferred):** length-normalized similarity (penaliza matches em strings muito mais longas que query). Ex `similarity() * (1 - abs(len(name) - len(q)) / max(len))`.
- **B:** edit distance (Levenshtein) tiebreak quando similarity empata (`levenshtein('lecge', 'leche')=1` < `levenshtein('lecge', 'lechuga')=3`).
- **C:** word_similarity sobre FIRST WORD exclusivamente (não string inteira). Ex `word_similarity('lecge', split(name, ' ')[1])`.

### Severidade

P3 nit. User encontra produto correto em #2 (não BLOCKER). Fuzzy chain S179-S182 overall producão-ready. Backlog S185.

---

## S183 REPROVADO (2026-11-26 11:28Z — PRs #140/#141/#142)

**Escopo:** Prisma Neon deploy resilience (ADR 0013 + render-build.sh + retry 3x backoff).

### Gate 3 ✅ + CI verde

- unit spec `render-build-url` 5/5 passing
- render-build.sh contém `derive_unpooled_url()` (strip -pooler + connect_timeout=30) + migrate retry 3x
- render.yaml buildCommand = `bash render-build.sh` ✅
- ADR 0013 documenta P1002 root cause + fix

### Gate 4 ❌ FAIL empírico prod

- 3/3 Render deploys build_failed (11:19, 11:23, 11:28Z)
- Erro consistente: P1012 `Environment variable not found: DATABASE_URL_UNPOOLED` em prisma generate
- Causa: **Render dashboard buildCommand inline** = `cd cesta-api && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build` — NÃO chama `render-build.sh`
- `derive_unpooled_url()` nunca executa → `DATABASE_URL_UNPOOLED` nunca setada → schema.prisma directUrl falha

### Prod atual

- Service `srv-dbst4muc6qcc73a3opr0` LIVE deploy `dep-dc412hff` commit `981ab30` (S182) desde 11:02Z
- /health 200 OK uptime 1069s
- Rodando S182 code — fuzzy rerank working, mas ADR 0013 resilience não aplicado

### Fix S184

PR `fix/sprint-184-render-blueprint-sync`:
- `ops/render-sync-blueprint.ts` — node script lê `cesta-api/render.yaml` buildCommand + PATCH `/v1/services/{id}` serviceDetails.envSpecificDetails.buildCommand via Render API
- ADR 0014 `docs/adr/0014-render-dashboard-blueprint-sync.md` — problema manual service sem blueprint autoupdate; fix script sync on-demand; trade-offs (blueprint reconnect destrutivo rejeitado)
- Dev executa script pós-merge, confirma dashboard buildCommand = `bash render-build.sh`
- Trigger deploy Render API pós-sync, confirma build_success + migrate retry logic executa

### S184 nits Reviewer gate 3 APROVADO (P3 non-blocker → S185+ backlog)

Comment: https://github.com/ArtudGabriel/cesta/pull/143#issuecomment-7191293573

- **Double-cd risk** — composed command `cd cesta-api && bash render-build.sh` + rootDir empty no dashboard. Se alguém setar rootDir=cesta-api manualmente no dashboard, double-cd quebra (cd cesta-api/cesta-api fail). Fix: assertar rootDir empty via GET pre-PATCH.
- **TS7/Node26 lockfile versions** — ops script pode usar TS features não disponíveis em CI node runtime. Verificar tsconfig target + engines.
- **findServiceId redundant** — script loopa services pra achar id, mas serviceId é estável e poderia ser env var ou const no script. Simplifica + remove dependência GET /services list.

### S184 fix empírico pos-apply

- Deploy 1 `dep-dc41p38u01pc73ekeftg` build_failed 34s — `nest: not found` (NODE_ENV=prod + npm ci sem devDeps = regression S183)
- Fix commit 3205616: `render-build.sh` npm ci `--include=dev`
- Deploy 2 `dep-dc41qdijnfac73b8fu40` LIVE + auto-merge 11:53:07Z
- Deploy main `dep-dc41r98jo6nc73b1ak4g` LIVE 11:55Z — Build logs confirmam derive_unpooled_url + migrate retry armed + prisma generate + nest build OK

### S185 nits Reviewer gate 3 APROVADO (P3 non-blocker → S186+ backlog)

Comment: https://github.com/ArtudGabriel/cesta/pull/144#issuecomment-7191570852

- **Spec pass-through only** — jest 6/6 testa apenas que endpoint retorna resultados, não valida SQL rerank logic diretamente. Adicionar spec que mocka pg_trgm + verifica score computation.
- **Boost cumulativo sem cap** — múltiplos boosts (prefix + first-word + short-direct-typo) somam sem ceiling; edge case extremo pode superar 1.0 similarity. Cap em 1.0 ou doc behaviour.

### S186 nits Reviewer gate 3 APROVADO (P3 non-blocker → S187+ backlog)

PR #145 (1a3d5bd) LIDL adapter yield recovery ADR 0016. Diff cirúrgico 1 regex parseSegment:129 (`[^}]*?` → `[\s\S]{0,2000}?`). Evidência probe 0/48→48/48 matches. Jest 196/196 catalog-sync pass.

- **Magic number** — `{0,2000}` byte cap inline, extrair const nomeada `MAX_PRICE_BLOCK_BYTES = 2000` com docstring explicando choice (ReDoS guard + LIDL payload size empírico).
- **Tracking issue opt(c)** — long-term replace regex por full JSON parse (opt c rejeitado ADR 0016). Criar GH issue "LIDL adapter: migrate from regex to JSON parser" pra follow-up pós-MVP quando throughput OR correctness demands.



## Empirical validation deferred — S187 (2026-11-26)

**Alvo:** chore/sprint-187-nits-cleanup-bundle (CODE-ONLY).
**Motivo:** cesta-gsvc.onrender.com SUSPENDED 2026-11-26 12:55Z (Render free tier 750h/mês esgotou Nov). Boss decidindo opção (wait reset Dec 1 / upgrade $7 VETO / Fly.io migrate / check manual suspension).

### Smoke prod pendente pós-restore

Executar quando prod volta (seja Dec 1 reset OR migrate alternativo):

1. **Suggest fuzzy SQL cap + tiebreak S185+S187** — `GET /products/suggestions?q=lecge` → top1 `Leche*`, ordem determinística 3-runs seguidos (char_length ASC tiebreak honored).
2. **LIDL MAX_PRICE_BLOCK_BYTES=2000** — `GET /products?supermarket=lidl` total ≥800 (baseline pós-S186 = 908). Nenhuma mudança funcional esperada; refactor puro de literal → const.
3. **AUTO_SYNC_ON_BOOT parse robusto** — próximo redeploy Render: setar env `AUTO_SYNC_ON_BOOT='TRUE '` (uppercase + trailing space) → bootstrap enqueue deve rodar. Antes S187 ficava silent no-op.
4. **setTimeout clearTimeout leak fix** — graceful shutdown (SIGTERM) pós-bootstrap Redis OK deve exit <1s (antes: até 30s pending timeout).

### Code shipped sem empírico

G1-G3 S187 todos shipped + CI verde + 511 jest + 250 vitest zero regression. Empírico defer até prod live.

### Follow-up tracking

- GH issue #146: LIDL migrate regex→JSON parser (P3 pós-MVP).

## Empirical validation deferred — S188 (2026-11-26)

**Alvo:** feat/sprint-188-prod-restoration-readiness (CODE-ONLY).
**Motivo:** cesta-gsvc.onrender.com AINDA SUSPENDED desde 2026-11-26 12:55Z. Boss ainda avaliando 3 opts (wait Dec 1 / $7 upgrade / Fly.io).

### Playbook pós-restore (ADR 0017)

Quando prod volta, executar em sequência:

1. `curl -sSI $PROD/health | head -n1` → confirm 200.
2. `cd ops && npm install && npm run smoke` → exit code 0 obrigatório antes de desbloquear empirical.
3. Marcar S187 + S188 entries desta mesma pendente.md como validated com timestamp.
4. Ping Boss `prod restored + smoke verde` pra escolher próxima sprint.

### Code shipped sem empírico

S188 G1-G4 todos shipped + CI verde:
- `ops/smoke-test-prod.ts` + lib + 20 vitest specs.
- `cesta-api/scripts/report-migrate-attempt.mjs` + bash shell spec (10 asserts).
- `render-build.sh` retry loop agora emite JSON estruturado (+ Sentry breadcrumb condicional) por attempt.
- ADR 0017 playbook + trade-offs.

### Follow-up tracking

Nenhum novo GH issue aberto em S188. Smoke script evolve com próximas features (ADR 0017 §Follow-up).

## Empirical validation deferred — S189 (2026-11-26)

**Alvo:** feat/sprint-189-smoke-expand-retry-util (CODE-ONLY).
**Motivo:** prod ainda SUSPENDED desde 2026-11-26 12:55Z. Boss decidindo opts (ADR 0017 playbook pronto).

### Smoke expanded pós-restore (ADR 0017 playbook)

Playbook do ADR 0017 agora cobre 9 sections em vez de 5:
- health
- auth-health (S189 G1 c, novo)
- products-total ≥8500
- supermarkets presence (6 supers)
- per-super-thresholds (S189 G1 b, novo) — mercadona≥2800, dia≥2000, eroski≥500, froiz≥250, aldi≥100, lidl≥600
- fuzzy-lecge (S189 G1 a — ex: aggregate agora granular)
- fuzzy-yogrt
- fuzzy-yoguer
- imageUrl-ratio ≥70%

Exit code 0 → libera chain S179-S189 empírico.

### Code shipped sem empírico

- `cesta-api/src/common/utils/retry.ts` + 14 jest specs (withRetry generalizando ADR 0013 + polite-fetch pattern).
- `ops/smoke-test-prod.lib.ts` +3 novas check functions + 3 novos integration mocks vitest (33/33 ops specs).

### Follow-up tracking

- Migrate polite-fetch internals → withRetry pós empirical restore (GH issue a abrir quando prod liberar).

## Empirical validation deferred — S190 (2026-11-26)

**Alvo:** refactor/sprint-190-adapters-retry-migrate (CODE-ONLY).
**Motivo:** prod ainda SUSPENDED. Boss opt restoration TBD.

### Mudança

Bundle S189 AJUSTE + revalidate retry refactor:
- G0 S189 AJUSTE: `@Public() @Get('/auth/health')` em `auth.controller.ts`
  (shipped PR #150; follow-up da auto-merge race).
- G2 withRetry adoption: `common/revalidate/revalidate.service.ts postWithRetry`
  delega a `withRetry` util com PermanentHttpError sentinel + isRetryable
  predicate (4xx non-retryable). Comportamento preservado byte-perfect
  (specs 8/8 inalteradas).
- G3+G4: 526 API tests + 250 web + 33 ops + 15 bash + audit:dtos/repos ✅.

### NÃO refactored

- `polite-fetch.ts`: tight HTTP contract (Retry-After header + minWaitOnBlock
  anti-bot + jitter). Migration → withRetry DEFERRED pós empirical restore.
- `backfill-images.processor.ts` + `catalog-sync.processor.ts`: BullMQ handles
  retry via job opts (`attempts`, `backoff`), não loop in-process.
- `users.service.ts enqueueHardDeleteDetached`: mesma BullMQ semântica.

### Pós-restore validation

Empirical smoke run (ADR 0017 playbook) deve confirmar:
- `/auth/health` 200 + `{module:'auth', status:'ok'}` (S190 G0).
- Revalidate retry comportamento preservado em webhook /api/revalidate pós
  mutation (produto, preço, review). Log messages inalterados pra observability.

## Empirical validation deferred — S191 (2026-11-26)

**Alvo:** feat/sprint-191-bullmq-worker-observability (CODE-ONLY).
**Motivo:** prod ainda SUSPENDED. Observabilidade pré-restore.

### Mudança

- `cesta-api/src/common/sentry/processor-observability.ts` — helpers
  `recordJobStart` + `recordJobError` + `isFinalAttempt`. Breadcrumb
  payload: {queue, jobId, name, attemptsMade, maxAttempts, data, errorMessage}.
  Sentry.captureException só no final attempt.
- Wire em 3 processors: catalog-sync (2 processors) + receipts + alerts.
- 12 jest specs cobrindo final-vs-retry split + payload shape + non-throw.

### G1 identified sites

- `catalog-sync.processor.ts` (CatalogSyncProcessor + CatalogSyncManualProcessor)
  — sem retry in-process; relies on BullMQ job opts.
- `receipts.processor.ts` — sem retry; status 'failed' persisted via repo.
- `alerts.processor.ts` (PriceAlertsProcessor) — sem retry.

### G3 decision

Zero processors têm retry loop custom. BullMQ queue opts (`attempts`,
`backoff`) config:
- `userCleanupQueue hard-delete`: attempts=3, exponential 60_000ms.
- `receiptsQueue`, `importsQueue`: attempts=1 (no retry).
- `priceAlertsQueue`, `catalogSyncQueue`, outros: BullMQ default
  (attempts=1).

withRetry util NÃO adotado em processors — domain diferente (external
queue retry owned by BullMQ worker loop). Recomendação futura: avaliar
se receipts/catalog-sync precisam attempts>1 w/ backoff pós prod empirical.

### Pós-restore validation

- Trigger job failure sintético em dev prod-shape → verificar Sentry
  recebe breadcrumb timeline + captureException no final attempt.
- Smoke /auth/health passa + fuzzy chain preservado.

## Empirical validation deferred — S192 (2026-11-26)

**Alvo:** feat/sprint-192-notifications-frontend-sentry (CODE-ONLY).
**Motivo:** prod ainda SUSPENDED. Frontend observability pré-restore.

### Mudança

- G1 SKIP: `notifications.processor.ts` não existe (NotificationsService
  é chamado síncrono por alerts.processor, Web Push send direto). Doc
  rationale PR body.
- G2 `cesta-web/src/lib/sentry-breadcrumbs.ts` — emitters GDPR-safe:
  recordSuggestRequest, recordProductsFetch, recordAuthAttempt.
  Payload NUNCA query text, email, senha, user ID, token. Allowed:
  q_len_bucket, sanitized filters (whitelist supermarket/category/
  sort/page/limit), result_count, total, status, error_code, duration_ms.
- Wired em catalog.service.ts (suggest + listProducts) + auth.service.ts
  (login + register).
- 23 vitest specs cobrindo bucketing, sanitize, 3 emitters + GDPR assertion
  (JSON.stringify payload NUNCA contém "leche entera" / "LEAKED TEXT" /
  email / password / userId / token patterns).

### Pós-restore validation

- Triggar login success + register failure + suggest timeout em dev prod-shape
  → Sentry dashboard filtra por category `api.auth`/`api.suggest`/`api.products`
  e confirma payload shape.
- Grep breadcrumb payloads em Sentry UI por qualquer PII leak zero-sanction
  (nenhum breadcrumb deve conter texto digitado).

## Empirical validation deferred — S193 (2026-11-26)

**Alvo:** feat/sprint-193-close-s71-nit-backlog (CODE-ONLY).
**Motivo:** prod ainda SUSPENDED. S71 nit backlog cleanup pré-restore.

### Mudança

**G1** `/ready` alias K8s/Render readiness (Prisma + Redis deep check).
`/health/deep` mantido pra backward compat monitors externos (UptimeRobot).
`/health` shallow liveness já existe S87. Opt (a) split acabou de ser
formalizado com alias padrão.

**G2** `cesta-web/src/lib/brand.ts` — single source JS/TS pros hex da marca
em contextos non-CSS (Next metadata.themeColor, satori ImageResponse OG,
sharp image generation). Refactored: `layout.tsx` + `opengraph-image.tsx`
importam de brand.ts. Scripts `.mjs` + `manifest.webmanifest` + globals.css
mantidos com literal (build-time ou context-specific — justificativa inline).

**G3** ADR 0018 `docs/adr/0018-catch-block-audit-adapters.md` — audit 37
catch blocks em adapters/processors. Veredito: nenhum silent swallow,
todos log via Logger + classification intencional (item-skip / adapter-null
/ retry delegated polite-fetch). withRetry S189 integration DEFERRED.

### Pós-restore validation

- `curl /ready` → 200 + report shape {status, checks: {db, redis}}.
- `curl /ready` quando Redis fake-down → 503 + body degraded.
- Render dashboard pode mudar healthCheckPath pra /ready (opt pós-restore).

## Empirical validation deferred — S194 (2026-11-26)

**Alvo:** feat/sprint-194-coverage-threshold-gate (CODE-ONLY).
**Motivo:** prod ainda SUSPENDED. Coverage threshold gate pré-restore.

### Mudança

- Baseline capturado 2026-11-26 full test:
  - API: statements 56.94% / branches 48.32% / functions 42.95% / lines 57.57%
  - Web: statements 35.28% / branches 29.75% / functions 30.3% / lines 35.81%
- Threshold rebase floor baseline -2pp:
  - API: 55/46/41/55 (jest.config em package.json)
  - Web: 33/27/28/33 (vitest.config.ts)
- Scripts novos: test:ci (bare) + test:coverage:gate (gate explícito).
- CI workflow: 2 steps distintos por projeto (tests fail-fast + coverage gate).
- README.md Coverage section reescrito com baseline+threshold table +
  regen baseline procedure step-by-step.

### Pós-restore validation

Nenhuma specific — coverage é code gate, não runtime. CI já passa baseline
com threshold novo.

## Empirical validation deferred — S195 (2026-11-26)

**Alvo:** chore/sprint-195-npm-audit-sweep (CODE-ONLY).
**Motivo:** prod ainda SUSPENDED. Dependency security sweep pré-restore.

### Resultado

**Audit baseline (pré-fix):**
- API: 0 high/critical, 8 moderate (devDeps only).
- Web: 0 high/critical, 7 moderate (devDeps only, transitive).
- Ops: 0 vulnerabilities.

**Pós `npm audit fix`:**
- API: 8 → 3 moderate (major bump @nestjs/cli 11→12 required).
- Web: 7 → 0. ✅
- Ops: 0 → 0.

### Majors deferred

- GH issue #157: `@nestjs/cli` 11.x → 12.x major bump. Impact dev-only, CI
  filter `--audit-level=high` cobre prod. P3 pós-MVP.

### Pós-restore validation

Nenhuma specific — mudança dev-deps only. Runtime inalterado.

## Empirical validation deferred — S196 (2026-11-26)

**Alvo:** feat/sprint-196-i18n-parity-audit (CODE-ONLY).
**Motivo:** prod ainda SUSPENDED. i18n parity gate pré-restore.

### Resultado

Baseline paridade ES vs PT-BR: **zero drift. 739 leaves aligned nos dois locales.**

### Mudança

- `cesta-web/scripts/i18n-parity.mjs` — audit flatten + diffLocales +
  collectTodos. Exit code 0 ok / 1 drift. ~175 LOC.
- `cesta-web/scripts/i18n-parity.spec.mjs` — 11 vitest specs (flatten,
  collectTodos, diffLocales incl. type mismatch).
- `package.json` + script `i18n:parity`.
- vitest.config.ts include += `scripts/**/*.spec.{mjs,ts}`.
- CI workflow web step novo "i18n parity gate".
- README i18n parity enforcement section + regen procedure + policy.

### Pós-restore validation

Nenhuma specific — enforcement estrutural. Gate ativo em futuras PRs
previne drift.

## Empirical validation deferred — S197 (2026-11-26)

**Alvo:** feat/sprint-197-a11y-audit-gate (CODE-ONLY).
**Motivo:** prod ainda SUSPENDED. a11y gate pré-restore.

### Mudança

- `cesta-web/scripts/a11y-audit.mjs` — spawn Next build+start, fetch 6
  rotas, axe-core via jsdom, threshold {critical:0, serious:5}, JSON
  report em `a11y-audit-report.json`.
- `cesta-web/scripts/a11y-audit.spec.mjs` — 14 vitest covering pure
  helpers (summarize, aggregate, evaluate, constants).
- devDeps: axe-core@4.14.1 + jsdom@29.1.1 explicit.
- CI web job step novo "a11y-audit" post-build + artifact upload 14d.
- continue-on-error: true no primeiro ciclo (baseline-gathering;
  API backend offline em CI = SSR pode render error page rotas
  protegidas inflate artificial).

### Pós-restore validation

Primeira run CI post-merge:
1. Baixar artifact `a11y-audit`.
2. Review `totals.critical + totals.serious`. Esperado 0 critical;
   serious varia por rota (home público-ok, login/perfil error-ish).
3. Sprint follow-up: tighten threshold + flip continue-on-error:false
   + baseline documented em ADR 0019 se required.

### Scope limitation

jsdom não renderiza paint — rules color-contrast/viewport skipped.
Real browser (Playwright) deferred pós-MVP conforme README.

## Empirical validation deferred — S198 (2026-11-26)

**Alvo:** feat/sprint-198-playwright-e2e-setup (CODE-ONLY).
**Motivo:** prod ainda SUSPENDED. E2E infra setup pré-restore (first smoke).

### Mudança

- `cesta-web/playwright.config.ts` — chromium headless, baseURL env-aware
  (PLAYWRIGHT_BASE_URL → BASE_URL → localhost:3000). Trace on-failure,
  screenshot/video retain-on-failure, retries=2 CI / 0 local.
- `cesta-web/tests/e2e/home.spec.ts` — 2 smoke tests:
  home title + combobox + typing abre dropdown (aria-expanded=true);
  navigation links presence.
- npm scripts: e2e, e2e:ui, e2e:install, e2e:report.
- `.github/workflows/e2e.yml` novo workflow — nightly 06:00 UTC +
  workflow_dispatch manual. Chromium cache + Next build + start +
  wait-on curl loop + artifact upload (report 14d, trace on-fail 7d).
- `.gitignore` += playwright-report + test-results + playwright/.cache.
- DevDep `@playwright/test`.

### Pós-restore validation

Primeiro trigger manual workflow_dispatch:
1. Actions tab → E2E → Run workflow (default base_url localhost CI).
2. Artifact `playwright-report` download → HTML report.
3. Confirmar 2/2 smoke pass.

Pós prod restored, override base_url=`https://cesta-web.vercel.app`
+ confirmar smoke prod-live. Nightly cron pega regressões automático.

### S199+ roadmap

- Fuzzy suggest backend live.
- PDP /produto/[pid] journey.
- /comparar add 2 produtos + diff.
- Login/register happy path.
- @axe-core/playwright replace jsdom S197 (paint rules + interactive states).

## Empirical validation deferred — S199 (2026-11-26)

**Alvo:** feat/sprint-199-bundle-size-gate (CODE-ONLY).
**Motivo:** prod ainda SUSPENDED. Bundle size CI gate pré-restore.

### Mudança

- `cesta-web/scripts/bundle-size.mjs` — lê .next/app-build-manifest.json,
  computa gzipped size per chunk (cache), agrega por route (firstLoad/
  pageOnly/shared heurística ≥50% routes), enforce threshold, report JSON.
- Threshold DEFAULT: firstLoadJs ≤200KB gzip, perPage ≤50KB gzip.
- `bundle:size` npm script + scripts/bundle-size.spec.mjs 11 vitest.
- CI web step novo "Bundle size gate" post-build + artifact 14d
  (continue-on-error primeiro ciclo baseline).
- ADR 0019 docs/adr/0019-bundle-size-baseline.md.
- README Bundle size section + commands + ADR link.

### Pós-restore validation

Primeira run CI post-merge:
1. Artifact `bundle-size` download.
2. Review JSON `routes[].firstLoadBytes` vs threshold.
3. Se baseline razoável (ex: todas rotas <180KB firstLoad):
   S200 flip continue-on-error:false.
4. Se baseline alta (rota excede 200KB): sprint refactor dep pesada
   OR threshold bump ADR novo.
