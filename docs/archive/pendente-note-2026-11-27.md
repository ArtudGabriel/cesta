# Cesta — Pendente

## Feedback oficial user 2026-11-27 (S227)

### Gate 4 PR #193 PDP crash — APROVADO ✅ 2026-11-27 12:50Z

### Re-gate 4 PR #192 S226 stale indicator — APROVADO ✅ 2026-11-27 ~18:35Z (pós-merge prod fe32cdc)

**PR #192 MERGED** fe32cdc 17:21Z · Render + Vercel deploys live.

**Froiz bug core RESOLVIDO ✅** (resolveIsStale OR fix):
- API `/api/v1/products/cmwhxtgxt009c12atcvh78h1y` (Arroz largo 1kg): `topIsStale=true` + todos 7 mercados `isStale=true` (Froiz lastSyncedAt 2026-11-15 agora retorna true como esperado).
- resolveIsStale(dbIsStale, lastSyncedAt) = dbIsStale OR computeIsStale(lastSyncedAt) — combina sinal adapter com fallback age-based.
- Jest coverage 61/61 pass (5 novos casos resolveIsStale).

**StaleBadge empírico 4 telas confirmado (PT-BR + ES) ✅:**
- Home `/`: 2 StaleBadge instances  com texto "Desatualizado"/"Desactualizado" + title tooltip 48h + Clock icon + data-sentry-unmask + role=status.
- PDP `/produto/<id>` hero: 1 StaleBadge (produto.isStale) com todos attrs.
- Favoritos `/favoritos`: 1 StaleBadge (fav.cheapestPrice.isStale) com todos attrs.
- Minha-lista `/minha-lista/<id>` list-item-row: 1 StaleBadge (PriceByMarketDto.isStale) com todos attrs.

**AJUSTES anteriores RESOLVIDOS ✅:**
- Tooltip 48h ✅: `title` + `aria-label` = "Este preço não é atualizado há mais de 48 horas." (PT) / "Este precio no se actualiza hace más de 48 horas." (ES).
- Icon Clock ✅: `svg.lucide-clock` presente em StaleBadge component.
- data-sentry-unmask ✅: attribute presente em todos StaleBadge (Dev clarify: não é GDPR blocker, é chrome diagnostic opcional pra Session Replay).
- Label "Desatualizado" / "Desactualizado" ✅ i18n ES/PT-BR toggle via `cesta:locale` cookie.

**Toggle ES↔PT-BR ✅ 4 telas**: cookie switch + reload → Label + tooltip alternam ES/PT-BR consistente.

**Nit non-blocker (defer S228 OR flag):**
- PDP "Preços em cada supermercado" (PriceComparisonGrid) ainda usa inline `span.text-amber` + AlertTriangle sem title/aria/Clock/sentry-unmask (6 badges per PDP). Hero StaleBadge cobre requisito tooltip 48h no PDP. PriceComparisonGrid per-market badges não bloqueiam critério gate 4 (4 telas core atendidas) — Dev pode migrar pra StaleBadge em sprint followup.

**Gate 4 veredito:** **APROVADO** empírico prod — regra `cesta.md` "UI mostra aviso quando isStale=true" cumprida. Froiz core bug fixado + 4 telas renderam StaleBadge canonical com tooltip + Clock + i18n + GDPR chrome opcional.

### Gate 4 PR #192 S226 stale indicator — AJUSTE ⚠️ 2026-11-27 ~17:55Z (preview Vercel; prod aguarda merge)

**PR #192 OPEN** (BEHIND main). Preview Vercel READY `cesta-web-git-feat-sprint-226-a4c6cc-gabriels-projects-f5aa3b24.vercel.app` + backend G1 WIP já deployed main=257cc56.

**G1 backend empírico ✅:**
- Endpoint `/api/v1/products` retorna `prices[].isStale: boolean` top-level e per-mercado conforme DTO.
- Carrefour `isStale=true` ✅ (frozen S213, lastSyncedAt 2026-11-15 = ~12d atrás >> 48h threshold)
- Alcampo `isStale=true` ✅ (frozen S213 idem)
- Mercadona/DIA/LIDL/Aldi `isStale=true` esperado nesta amostra (lastSyncedAt old).
- `PRICE_STALE_THRESHOLD_HOURS` env NÃO existe em Render prod (default 48h aplica).

**G2 UI badge preview PDP /produto/cmwhxtgxt009c12atcvh78h1y:**
- ES: 6 badges `span.text-amber` com texto "⚠️ precio desactualizado" ✅ (Aldi/LIDL/Mercadona/DIA/Alcampo/Carrefour)
- PT-BR: 6 badges "⚠️ preço desatualizado" ✅ (toggle via `cesta:locale` cookie funciona)
- Icon: `lucide-triangle-alert` h-3 w-3 ✅ (divergência PR body menciona "Clock icon" — nit cosmético)
- Cores: `text-amber` ✅

**G2 UI badge home grid preview /:**
- ProductCard renderiza sem StaleBadge pra produtos LIDL (isStale=false, LIDL daily sync S225 fresh) ✅ comportamento esperado.
- Não achei card com isStale=true na home top 30 produtos (ofertas destacadas são LIDL fresh). Pass negativo não comprova mas não é bug.

**AJUSTE Dev (3 findings não-conformidade PR body):**
1. ⚠️ **Tooltip 48h AUSENTE**: PR body promete "tooltip i18n" com texto "Este precio no se actualiza hace más de 48 horas." / "Este preço não é atualizado há mais de 48 horas." — nenhum span badge tem `title` nem `aria-label` nem Radix tooltip detectado. User tap/hover não mostra tooltip. Falta implementar.
2. ⚠️ **data-sentry-unmask AUSENTE**: PR body promete `data-sentry-unmask` por Sprint 59 GDPR regra (badge é chrome público). Nenhum badge (0/6) tem o attribute. Regra permanente CLAUDE.md Cesta: "Novo componente que renderiza PII do usuário DEVE ganhar `data-sentry-mask`" + badge é chrome (unmask). Non-blocker pra UX mas quebra regra Sprint 59.
3. ⚠️ **Icon divergência**: PR body "Clock icon" vs actual "alert-triangle" — Dev decisão intencional ou typo? Alert-triangle é aceitável semanticamente mas documentação ADR 0034 precisa refletir.

**Suspeita backend non-blocker (flag Dev):**
- Froiz lastSyncedAt 2026-11-15 (~12d atrás) retorna `isStale=false` em 3/3 samples quando threshold default 48h deveria dar `true`. Hipótese: computeIsStale pode ter per-supermarket override OR bug threshold. Confirmar se é design decision (weekly sync adapter exemption) ou bug.

**Testes NÃO executados (precisam prod merge + sessão login):**
- /favoritos (requer login válido no preview URL cross-domain cookie problem)
- /minha-lista/[id] list-item-row (requer login + lista com item)
- Prod final empírico pós-merge

**Gate 4 veredito:** **AJUSTE** — core funcionalidade OK (payload backend + badge ES/PT-BR em PDP) mas tooltip i18n + data-sentry-unmask ausentes vs PR DoD. Froiz 12-day isStale=false flag pra Dev validar. Re-test full pós-merge e após Dev addressar nits.

### Gate 4 PR #203 ADR 0035 cross-region proposta — APROVADO docs ✅ 2026-11-27 ~17:45Z

**PR #203 docs-only** (BLOCKED aguarda Reviewer gate 3). Status ADR: **Proposto** (Boss leva user, NÃO executa).

**Sources validadas (curl HEAD):**
- render.com/pricing · render.com/docs/regions · neon.com/pricing · neon.com/docs/changelog/2025-08-15 · vercel.com/docs/pricing/regional-pricing/fra1 → todos 200 ✅
- grep `frankfurt` + `Oregon` + `Ohio` + `eu-central-1` presentes em render + neon docs ✅

**Claims regionais confirmados ✅:**
- Render Frankfurt = AWS eu-central-1 (confirma community doc)
- Neon aws-eu-central-1 Frankfurt disponível 2025-08-15 (confirma neon changelog)
- Render não permite change region in-place (confirma community post 5987)

**Latência claims realistas ✅:**
- Paris↔Oregon ~150ms (industry: transatlantic 140-180ms típico)
- Oregon↔Ohio ~60ms (cross-US continental)
- Paris↔Frankfurt ~15ms (intra-EU peering)
- Frankfurt intra-region ~3-5ms (same DC)
- Delta 620ms→75ms teórico (8×) razoável, ADR flag explicit "validar empírico" antes execução

**Nit non-blocker** (flag Dev S228 docs):
- Neon Launch quoted "/mês + CU-hours /usr/bin/bash.106" vs neon.com/pricing atual mostra "Typical spend about **5/month** on Launch" + CU-hour /usr/bin/bash.10 (Launch). Memory `project-mvp-stack-zero-cost.md` tem  stale. ADR delta regional $0 claim holds (Neon price não diferencia região) — nit é só número absoluto Launch, não afeta decisão migração.

**Trade-offs cobertos ✅:**
- Custos delta $0 (parity tier-based; caveats citados)
- Downtime 1-3min DNS cutover + 10min write-freeze catalog-sync + 48h rollback window
- Risco alto/médio/baixo categorizados (DATABASE_URL change, Neon maintenance window, Render region immutable)
- Rollback 48h window + Neon branching backup
- 4 alternativas descartadas (só Neon / só Render / Vercel iad1 / trocar vendor)

**Gate 4 veredito:** APROVADO docs-only. Sources acessíveis, claims regionais + latência razoáveis, trade-offs completos, status Proposto respeitado (não executa). Pricing nit flaggado (não bloqueia aprovação proposta).

### Gate 4 PR #202 #1/#2 PERF quick wins — APROVADO ✅ 2026-11-27 ~17:30Z

**PR #202 MERGED** d710357 · Vercel deploy success.

**Delta medido empírico prod mobile 390px (portal Cesta Mobile, Vercel edge cdg1):**

**Home `/`:**
- Baseline (main f6d0c6e): TTFB 21ms · req 292ms · load 55ms · transfer 19KB · decoded 64KB
- After (d710357 warm 2nd): TTFB 20ms · req **221ms** (**-71ms = -24%**) · load 38ms · transfer 20.7KB (+1.7KB) · decoded 71KB
- After (d710357 cold 1st): req 944ms (SSR fetch categorias no server-side primeira vez; subsequent CDN edge cache via revalidate=300)

**PDP `/produto/cmwhxsyby000w12ati8g03af1` (Leche entera brik 1L):**
- Baseline (f6d0c6e cold): req 1899ms
- After (d710357 warm): req **1195ms** (**-704ms = -37%**)

**BottomNav instant render ✅:**
- 5 links renderizados imediato (Inicio/Mi lista/Favoritos/Comparar/Cuenta)
- 0 skeleton .animate-pulse count
- useProfile() removido do nav — fetch /users/me (380ms) ainda ocorre pra outras features mas nav não espera

**Home SSR categorias ✅:**
- 16 categorias embedded HTML inicial PT-BR: Todas · Laticínios e ovos · Pão e bolos · Café da manhã e cereais · Carnes · Peixes · Frutas e verduras · Bebidas · Mercearia · Molhos e conservas · Snacks e doces · Congelados · Limpeza · Higiene e beleza · Bebês · Pets
- Payload +1.7KB transfer aceitável (elimina chips skeleton)

**Prefetch rotas RSC ✅:**
- performance.getEntriesByType('resource') lista 8 prefetches Next.js RSC: /perfil + /minha-lista + /comparar + /favoritos (durações 58-138ms curtas, idle callback fire+forget)

**Gate 4 veredito:** APROVADO empírico delta positivo (-24% home warm, -37% PDP warm, 0 skeleton nav, categorias SSR embedded, 4 rotas prefetched). Cold home trade-off aceitável (CDN edge cache amortiza após 1ª visit).

### Gate 4 PR #201 #12 favoritar animation — APROVADO ✅ 2026-11-27 ~14:35Z

**PR #201 MERGED** f6d0c6e · Vercel deploy success.

**Testes empírico PDP `/produto/cmwhxsyby000w12ati8g03af1` (Leche entera brik 1L) prod mobile 390px:**
- **Pulse animation ✅**: heart icon classList `transition-all duration-300 ease-out` + state favorited aplica `fill-coral text-coral` instant. Btn wrapper class `before:abs` (ring pulse ::before). Screenshot `maestri-portal-312e99eb-947f-44fe-b529-2c76643d88d0.png` captura red dot pulse residual pós-click.
- **ES add toast ✅**: click heart (state unfav) → aria `Añadir a favoritos` → `Quitar de favoritos` + sonner li "Añadido a favoritos".
- **ES remove toast ✅**: click heart (state fav) → dialog "¿Quitar este producto de tus favoritos? Cancelar/Confirmar" → confirm → aria volta `Añadir a favoritos` + sonner li "Quitado de favoritos". Screenshot `maestri-portal-312e99eb` toast verde pill top.
- **PT-BR add toast ✅**: switch /perfil → Português(BR) → PDP → click → sonner li "Adicionado aos favoritos".
- **PT-BR remove toast ✅**: click → dialog "Remover esse produto dos seus favoritos? Cancelar/Confirmar" → confirm → sonner li "Removido dos favoritos". Screenshot `maestri-portal-45fe3629-0ad5-4964-ab48-20fa3149f830.png` dialog PT-BR.
- **Toggle aria correta ambos locales**: Añadir↔Quitar / Adicionar↔Remover ✅.

**Gate 4 veredito:** APROVADO empírico PDP pulse + 4 toasts localizados + dialog confirmação localizada.

### Gate 4 PR #200 #6 i18n PT-BR — APROVADO ✅ 2026-11-27 ~14:05Z

**PR #200 MERGED** 07c6223 · Vercel deploy success.

**Testes empírico prod mobile 390px toggle ES↔PT-BR:**
- **Home PT-BR**: categorias chips TRADUZIDAS ✅ "Laticínios e ovos" / "Pão e bolos" / "Café da manhã e cereais" (antes PR #200: literal ES). UI chrome ✅ "Buscar produto…" / "Melhores ofertas" / "Mais barato" / "Desconto de X por cento" / "Alertas" / "Meus gastos" / "Minha cesta familiar". Nav bottom "Início / Minha lista / Favoritos / Comparar / Conta" ✅. Filtros "Vegano / Vegetariano / Sem glúten / Sem lactose" ✅.
- **Switch ES via /perfil**: click "Español" → home → categorias volta "Lácteos y huevos" / "Pan y bollería" / "Desayuno y cereales" ✅. "Mejores ofertas" / "Mis gastos" ✅.
- **Nomes produto/marca MANTÉM ES**: "SILVERCREST® Espumador de leche" / "Queso viejo de oveja Hacendado" em ambos locales ✅ (comportamento esperado — aguarda decisão user).
- **Toggle bidirectional perfil não derruba sessão** ✅ (bug walkthrough S226 anterior resolvido).
- **/perfil + /minha-lista + /comparar** herdam locale via cookie `cesta:locale` + UI shell traduzida.

**Gate 4 veredito:** APROVADO empírico toggle ES↔PT-BR + categorias traduzidas + UI shell + produto/marca intactos.

### Gate 4 PR #199 #3 produto sem foto — APROVADO ✅ 2026-11-27 ~13:45Z

**PR #199 MERGED** 74cd9eb · Vercel deploy success.

**Testes empírico prod mobile 390px:**
- **PDP Lomo curado cerdo Duroc** `/produto/cmwy6d03m02dbe49dkw0ir9b0` (imageUrl=null): `[role=img][aria-label=Sem foto]` ✅ PT-BR + ícone ImageOff (câmera riscada) centrado + label "Sem foto" visível + background cinza claro ESTÁTICO (não animate-pulse skeleton) ✅.
- **PDP mesmo produto ES**: switch /perfil → Español → re-navigate → `[role=img][aria-label=Sin foto]` + texto "Sin foto" ✅.
- **Home grid /** ES: scan `[role=img][aria-label*=foto]` → **17 fallback elements 64x64px** (product-card.tsx thumbnails sem showLabel) + **0 skeleton animate-pulse** ✅.
- **list-item-row /minha-lista**: parcial — add Lomo falhou "Token inválido" (session expired mid-test); Caña de lomo Navidul tem imageUrl=OK (img render normal 48x48). Path code idêntico PDP+home (ProductImage `showLabel={false}`) + Dev vitest 5/5 pass product-image + 345/345 full suite.
- **Favoritos** fora scope PR (Dev defer S228 — manual Heart fallback antigo).

**Transição vs prod anterior:**
- Antes: `/placeholder.webp` 2x2px cinza vazio sem label — user confuso loading vs placeholder.
- Agora: ícone semântico + label localizado + background estático — usuário entende imediato.

**Gate 4 veredito:** APROVADO empírico PDP + home grid + i18n ES/PT-BR. List-item-row inferido pelo pattern code idêntico + vitest dev.

### Gate 4 PR #198 #5 follow-up parser Resend — APROVADO código ✅ · DELIVERY BLOCKED sandbox ⚠️ 2026-11-27 13:27Z

**PR #198 MERGED** a858752 13:23Z · Render deploy dep-* LIVE a858752 13:24:09Z.

**Boot log pós-deploy (from VÁLIDO):**
```
[EmailService] Resend ativo (from=Equipe Cesta <onboarding@resend.dev>). Envios reais habilitados.
```
→ formato email RFC válido ✅ (antes PR #196: `Cesta <Equipe Cesta <onboarding@resend.dev>@resend.dev>` inválido). Parser PR #198 opt-c (string com `<` usa direto) funciona.

**Teste empírico 2 registers prod mobile 390px:**
- 13:26:07Z `gabriel_dutra98+cestaqa227v2@hotmail.com`: Resend **403 testing mode** "You can only send testing emails to your own email address (ogabrielldutra@gmail.com). To send emails to other recipients, please verify a domain at resend.com/domains".
- 13:26:48Z `ogabrielldutra+cestaqa227@gmail.com`: mesmo 403 — Resend sandbox check exige MATCH EXATO owner sem plus-alias.

**PROTOCOLO FIX CONFIRMADO ✅**: transição 422 Invalid from (PR #196) → 403 testing mode (PR #198) prova composição from agora RFC válida. Sem o fix PR #198 Resend rejeita no stage parse (422); com fix parse OK e rejeita no stage auth (403 sandbox).

**DELIVERY BLOCKED por Resend sandbox (issue infra, não código):**
- Resend conta Cesta em dev/testing mode: só entrega pra `ogabrielldutra@gmail.com` exato (dono conta).
- QA não pode registrar bare `ogabrielldutra@gmail.com` ("O e-mail ou telefone já está cadastrado" conta pré-existente).
- API `POST /auth/resend-verification` auth-gated (401 Token ausente sem bearer), não permite trigger externo.
- Boss criteria "GET /emails last_event=delivered" não atingível sem: Resend API key (não disponível em secrets) + domínio custom verificado em resend.com/domains OR destinatário bare owner.

**Ganho observabilidade ✅ (PR #196+#198 cumulativo):**
- Logs Render expõem Resend error_name=validation_error + statusCode=403/422 + mensagem completa.
- Sentry.captureMessage registra ambos cenários.
- QA diagnosticou root cause 100% via Render API logs sem dashboard Resend.

**Gate 4 veredito:** **APROVADO código** (parser fix empírico OK, 422→403 transition). **DELIVERY PENDENTE Boss/user ação externa**: (a) verificar domínio `cesta.app` em resend.com/domains OR (b) adicionar emails testing recipients em Resend sandbox OR (c) prover Resend API key pra QA validar via `GET /emails` futuro.

### Gate 4 PR #196 #5 email verify Resend — REPROVADO ❌ 2026-11-27 13:14Z

**PR #196 MERGED** 74a5ce1 13:09:06Z · Render deploy dep-dc4o1te0tbcc73dbp6a0 LIVE 74a5ce1 ~13:10:46Z.

**Boot log confirma composição errada:**
```
[EmailService] Resend ativo (from=Cesta <Equipe Cesta <onboarding@resend.dev>@resend.dev>). Envios reais habilitados.
```

**2 testes empíricos REPRO FALHA:**
- 13:11:18Z register `cesta-qa-s227-1795785021@mailinator.com` → `Resend falhou para ce***@mailinator.com: [validation_error status=422] Invalid 'from' field. The email address needs to follow the 'email@example.com' or 'Name <email@example.com>' format.`
- 13:13:10Z register `gabriel_dutra98+cestaqa227@hotmail.com` → mesmo erro `Resend falhou para ga***@hotmail.com: [validation_error status=422] Invalid 'from' field.`

**Root cause Env Render:**
- `RESEND_FROM_ADDRESS` contém `"Equipe Cesta <onboarding@resend.dev>"` (string COMPLETA Name+Address+Domain) — Dev PR #196 assumiu LOCAL PART apenas.
- `RESEND_FROM_DOMAIN` = `"resend.dev"` (OK)
- `RESEND_FROM_NAME` NÃO EXISTE (default 'Cesta' aplica)
- Composição código `${name} <${address}@${domain}>` gera `Cesta <Equipe Cesta <onboarding@resend.dev>@resend.dev>` — formato inválido Resend API.

**Ganho observabilidade ✅ (parte do fix OK):**
- Sentry.captureMessage + Render log agora expõem Resend error_name=validation_error + statusCode=422 (antes silent). QA pôde diagnosticar via Render logs API.
- Boot log "Resend ativo (from=X)" confirma config at startup.

**Fix opções Dev follow-up (próximo PR):**
1. Parser code: se `RESEND_FROM_ADDRESS` contém `<` OR `@` OR space, tratar como string from completa (skip composição name/domain).
2. OR Boss coordena com user atualizar env Render `RESEND_FROM_ADDRESS="onboarding"` (local part only) — memory Boss "NÃO alterar env vars sem Boss" vigente.
3. OR renomear env pra `RESEND_FROM_LOCAL_PART` + migration path.

**Gate 4 veredito:** REPROVADO empírico. Delivery ainda falha. Reabrir bug #5.

### Gate 4 PR #195 iOS bundle 2 — APROVADO ✅ 2026-11-27 13:00Z

**PR #195 OPEN** (BLOCKED aguarda CI). Preview Vercel READY `cesta-web-git-fix-s227-bundle-eea948-gabriels-projects-f5aa3b24.vercel.app`.

**Fixes testados empírico preview mobile 390px (DOM eval; iPhone Safari-specific validação user):**
- **#4** viewport-fit=cover ✅ presente em `meta[name=viewport]`: `width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover`.
- **#4** `main` body padding-bottom computed=64px em Chromium (sem notch); formula `calc(4rem + env(safe-area-inset-bottom, 0px))` cobrirá home-indicator iOS +34px automaticamente.
- **#4** `nav` inline style `padding-bottom:env(safe-area-inset-bottom, 0)` mantido — combina com viewport-fit=cover ativo.
- **#7** home search-bar input: `type=search` + `autoCapitalize=none` + `autoCorrect=off` + `spellcheck=false` + `inputMode=search` + `enterKeyHint=search` ✅.
- **#7** compare-add-sheet input: mesmos 6 attrs ✅.
- **#7** add-product-modal (minha-lista drawer): Dev pattern aplicado 3 inputs uniformemente — preview não testável sem session cross-domain cookie (preview auth 401 'Token ausente') mas Dev test plan confirm vitest 7/7 pass.

**Gate 4 veredito:** APROVADO empírico Chromium DOM. **QA iPhone Safari user:** valida visual (home-indicator não corta nav) + keyboard search botão return 'Buscar' + sem autocapitalize em "leche".

### Gate 4 PR #194 bundle 1 throttler — PARCIAL APROVADO ✅ 2026-11-27 12:55Z (front only; backend pós merge)

**PR #194 OPEN** (BEHIND main; CI api+web pending). Preview Vercel READY `cesta-web-git-fix-s227-bundle-1e3a99-gabriels-projects-f5aa3b24.vercel.app` deployment `6F3DXd8eck3VbU8FfivToMb62FwH`.

**Front changes testadas prod mobile 390px:**
- Empty state drawer `/minha-lista/<id>` → Agregar producto → busca `zzzqwerty` renderiza **"Ningún producto coincide con la búsqueda."** ✅. Antes drawer colapsava silenciosamente.
- Bottom nav guard removal: após burst 30 req `/products/search?q=leche` (20x 200 + 10x 429 confirma strict throttler ainda ativo prod) → nav `/favoritos` + `/perfil` + `/` → bottom nav PERSISTE (Inicio/Mi lista/Favoritos/Comparar/Cuenta) ✅. Fix `isError return null` → skeleton fallback OK.
- Sentry segment capture `minha-lista/[id]/error.tsx` não verificável sem dashboard; path reforçado igual PR #193.

**Backend throttler 10k/60s NÃO TESTÁVEL pré-merge** (preview Vercel aponta prod cesta-gsvc.onrender.com shared backend). Burst 30 req confirma strict ainda 20/60s antigo. Post-merge Render auto-deploy esperado 2-3min.

**Gate 4 veredito:** APROVADO empírico front; backend validação adiada pós merge. QA re-testa 10 PDPs consecutivos quando Render live PR #194 commit.

**Commit:** 408a9ad (fix/s227-10-crash-pagina-produto) merged main 12:47:10Z. Vercel deploy success 4rzYBCPhhqc9A82UUJfCtScjzgGF.

**Fixes testados empírico prod mobile 390px:**
- scene7.com host: `/produto/cmwo2df37003i3v5hdj1z1h9r` (Aceite oliva suave CARBONELL Aldi) → renderiza nome + preço 3,99€ + Aldi mercado sem crash. Img externa aparece broken-icon (CDN 403/404) mas página inteira carrega ✅.
- dia.es host: `/produto/cmwnym53k0jyt28gp71bk61ld` (Aceite virgen extra Hojiblanca 500ml) → renderiza img Hojiblanca completa + 4,69€ + DIA ✅.
- Cerveza San Miguel (antes crashou 2x): `/produto/cmwnykqbq0ifg28gpy1v6ktmf` → renderiza lata + 0,75€ + DIA ✅.
- imageUrl="" scenario: scan 500 produtos (page 1-5) sem matches empty string. Edge case Dev identificou via grep — defer re-teste quando aparecer prod (fix safe: `||` falsy-coalesce cobre null/undefined/"").
- Sentry segment capture: `error.tsx` Sentry.captureException com tags não verificável sem dashboard Sentry. Teste prod positivo (não crasha) → observabilidade enterrada mas path reforçado.

**Hipótese QA pré-fix (throttler 429) REFUTADA pelo Dev:** root cause real era Next Image SSR crash em hosts externos não listados em `next.config.ts` remotePatterns + `imageUrl=""` vazando pelo `??` nullish-coalesce. Throttler 429 observado paralelo (ortogonal) — ainda ativo em prod mas não é causa #10/#11.

**Bundle E parcial resolvido:** #10/#11 ✅ (PDP crash). #14 busca lista + #15 add silent + lista cache + #16 bottom nav Safari ainda pendentes (bugs separados de causas distintas — Dev confirmou scope PR #193 tight PDP only).

---

### Repro pack — original (ver detalhes seções seguintes por bug)

**Contexto:** 17 itens iPhone Safari (bundle completo nota Sprints S227). QA reproduz em prod mobile 390px portal 'Cesta Mobile' (https://cesta-web.vercel.app). Backend prod https://cesta-gsvc.onrender.com.

**Env test:** register fresh user `qa-s226b-1795782286@cesta-qa.test` 2026-11-27 ~12:25Z · listId `cmwyyps3707akmw6xr5rj0rbm`.

---

### P0 BUNDLE E (bloco lista+nav+produto) — bloqueia catálogo

**#10/#11 CRASH página produto 'Algo salió mal' REPRODUZIDO**
- Rota: `/produto/<id>` qualquer (ex `/produto/cmwnykqbq0ifg28gpy1v6ktmf` = Cerveza San Miguel 33cl)
- Passos reprod: navigate direto URL produto OR nav rápido entre 2+ produtos consecutivos. Primeira visit crasha; reload client-side 10-60s depois carrega OK.
- Esperado: página produto renderiza (img + preços por mercado + nutri + histórico).
- Obtido: `Algo salió mal / Hubo un problema inesperado. Intenta recargar. [Recargar] [Volver al inicio]`.
- Root cause: **SSR fetch Next.js bate throttler API (429)** → erro propaga pra Error Boundary. Reproduzido empírico:
  - `GET /api/v1/products/cmwnykqbq0ifg28gpy1v6ktmf` direto curl = `429 ThrottlerException: Too Many Requests` (durante browse).
  - `GET /api/v1/auth/me` + `/telemetry/vitals` também 429 na mesma janela.
  - Após 60-70s cooldown mesma URL retorna `200 {data:{name:"Cerveza 0,0%...",prices:[{supermarketSlug:"dia",price:0.75,...}]}}`.
- Dado produto válido (packageSize=1, packageUnit=LITER, prices.length=1, nenhum campo null crítico). Causa ≠ nullability tipo gerado.
- Console error: sem erros client-side específicos (SSR crash — error.tsx renderizado server-side antes hydration).
- Sentry breadcrumbs: `__SENTRY__.getCurrentHub().getScope().getScopeData().breadcrumbs = []` no cliente (erro aconteceu SSR).
- Network tab: cliente só puxou `/api/v1/auth/me 200`, `/users/me 200`, `/telemetry/vitals 202` (sem /products/{id} client-side). SSR não loga em perf timeline do browser.
- Suspeita Dev: throttler strict (5/60s) OU global default sem retry/backoff no SSR productsApi.getById. Evidência bug S98+S106 similares — throttler global ainda vigente apesar override inline.
- Screenshot: `C:\Users\gabri\AppData\Local\Temp\maestri-portal-4be2611c-0d52-42bc-bc36-85c05ba42790.png` (tela crash) + `maestri-portal-ac9739a5-440b-4d22-ab3f-51954396bb51.png` (reprod 2x com nav rápido).

**#14 busca dentro /minha-lista drawer 0 results REPRODUZIDO**
- Rota: `/minha-lista/<id>` → click `Agregar producto` → input `Buscar producto…`
- Passos reprod: typing "leche" durante janela throttler ativa → drawer colapsa, sem results, sem empty state, sem error msg.
- Esperado: lista produtos filtrados OR mensagem "sin resultados".
- Obtido: drawer vazio (só input `Buscar producto…` visível), nenhum feedback ao user.
- Root cause: `GET /api/v1/products?search=leche` retornou 429 ThrottlerException silently → front engoliu erro + não mostrou empty state. Após cooldown mesma query retorna 7+ results (Barritas crujientes Hacendado, Arroz con leche, Panes de leche, etc).
- Screenshot drawer colapsado leche = `C:\Users\gabri\AppData\Local\Temp\maestri-portal-f911fc3f-cbf5-415d-9c6b-058d5ab77fa5.png`
- Screenshot leche com results (pós cooldown) = `C:\Users\gabri\AppData\Local\Temp\maestri-portal-aee2d982-296b-473d-a18f-fbb728b0f6ff.png`
- "coca" returned 7+ results OK na mesma sessão (sorte com throttler window).
- "coca zero" (com espaço) retornou 0 results API = `{data:[],total:0}` → front mostra drawer vazio sem msg = user acha busca quebrada. Fuzzy backend não quebra em "coca zero" tokens multi-palavra.
- Ranking busca "leche" → prioriza produtos que CONTÊM "leche" antes de produtos que COMEÇAM com "Leche" (Barritas > Leche entera brik 1L). Tangencial.

**#15 lista aparece 0 productos + add silent fail REPRODUZIDO**
- Rota: `/minha-lista` → click lista criada
- Passos reprod: criar lista "QA S227 Test" → OK (criação funciona, redirect /minha-lista/<id>). Click `Agregar producto` → typing "leche entera" → click botão `+` no primeiro resultado → drawer fecha → tela lista mostra "SIN PRODUCTOS · 0 UNIDADES".
- Esperado: produto adicionado aparece na lista + total atualizado.
- Obtido: lista permanece vazia (0 productos) sem msg de erro, sem toast. Click add consumido silenciosamente.
- Após sair + voltar via bottom nav `Mi lista`: página `/minha-lista` mostra "Aún no tienes listas" (bug reportado user `lista no encontrada`). Após re-login mesma sessão: lista "QA S227 Test" aparece listagem com "0 productos".
- Root cause: provável mesma janela throttler → POST `/api/v1/shopping-lists/<id>/items` retorna 429 ou 401 (shopping-lists auth-gated, requer cookie session) sem feedback UI. GET /shopping-lists também cacheado stale.
- Alerta cross-domain cookie: `/api/v1/shopping-lists` fetch manual com `credentials:'include'` retorna `401 Token ausente` apesar do app estar logado. Client-side React Query bateu 200 na mesma rota. Cookie httpOnly cross-site (Vercel ↔ Render) pode falhar em alguns contexts browser (SameSite).
- Screenshot "SIN PRODUCTOS" pós add = `C:\Users\gabri\AppData\Local\Temp\maestri-portal-45ce0d66-6ffa-4786-8f06-8d85fc15708c.png`

**#16 bottom nav SUMIU após sair lista — NÃO REPRODUZIDO em Chromium**
- Rota: `/minha-lista/<id>` → Volver → `/minha-lista`
- 3 cycles enter/exit lista: bottom nav sempre visível (Inicio · Mi lista · Favoritos · Comparar · Cuenta).
- Hipótese Dev: bug iOS Safari standalone PWA (viewport-fit=cover ausente, env(safe-area-inset-bottom)=0, hidden bars). Portal Chrome não emula Safari standalone. User testa iPhone Safari+PWA = ambiente distinto.
- Confirmado manifest.webmanifest tem `display:standalone` + lang:es + 3 icons mas SW NÃO registrado em runtime (`navigator.serviceWorker.getRegistrations() = []`). PWA install sem offline → first launch em iOS Safari pode se comportar diferente que Chromium.

---

### Bundle 2+ repro findings — restantes P0/P1/P2 2026-11-27 13:00Z

**#5 email verify Resend dev — PARCIAL (user-only verificação final)**
- Rota: `/register` + `/` banner "Confirme seu e-mail" + button "Reenviar enlace"
- API client: `POST /api/v1/auth/resend-verification` retorna 200 OK ✅ (confirmed network tab after click).
- Entrega real email NÃO verificável do portal (sem acesso mailbox). Dev checa Render logs Resend API response + confirma envio real. Resend dev mode docs: 1 email per conta Resend (só owner), bug user confirma com fresh emails qa-s226-*@cesta-qa.test (fake domain nunca recebe).
- Dev task: check `cesta-api/src/modules/auth/*` Resend provider + Render logs grep `resend` + `verification`.

**#1 #2 lentidão + bottom nav demora — CONFIRMADO empírico**
- Rota: qualquer (medido home + PDP leche)
- Front SSR (Vercel edge Paris cache HIT): home FCP 400ms · PDP cmwhxsyby FCP 1908ms · TTFB 19ms (edge local).
- Client API (Render OREGON): `GET /api/v1/products?limit=1` 3 requests warm = 1165ms + 1369ms + 1369ms (média 1.3s per call).
- Causa transatlantica: Vercel Paris edge (cdg1) → Render OREGON (us-west-2) → Neon us-east-2 = 2 travessias Atlantic 180-200ms each + DB roundtrip. Bottom nav useProfile(/users/me) blocks skeleton render até 1-1.4s resolver.
- Memory `[[feedback-mvp-stack-zero-cost]]` + Manager ADR hint: Frankfurt (eu-central) + Neon EU seria 1 region europe = <50ms RTT. Decisão Boss+user (custo + migração stack).
- Dev-independent agora (não code fix; infra): reportar user via Boss ADR estrutural com custo Fly.io eu-central OR Render Frankfurt OR Hetzner EU VPS.

**#3 produto sem foto — CONFIRMADO cosmético**
- Rota: `/produto/<id>` qualquer sem imageUrl (ex `/produto/cmwy6d03m02dbe49dkw0ir9b0` Lomo curado cerdo Duroc)
- Placeholder path: `src=/_next/image?url=/placeholder.webp&w=828&q=75` → arquivo real 2x2px (naturalWidth=2 naturalHeight=2). Img invisible visible=0.
- UX: box cinza grande (343x192px) sem ícone sem texto "Sin foto". User confuso loading vs placeholder.
- Fix Dev: substituir `/placeholder.webp` 2x2 por SVG com ícone centrado + copy localizado ES "Sin foto" / PT "Sem foto".

**#6 i18n PT-BR — PARCIAL (UI OK, categorias ES hardcoded)**
- Rota: `/perfil` → click Português(BR) → nav home
- UI shell traduzido ✅: 'Buscar produto…', 'Melhores ofertas', 'Mais barato', 'Desconto de X por cento', 'Sem glúten/lactose', 'Alertas/Meus gastos/Minha cesta familiar', 'Início/Minha lista/Favoritos/Comparar/Conta', 'Confirme seu e-mail/Reenviar link', 'Embalagem de 1 L', 'Nota nutricional: B'.
- Categorias home chips NÃO traduzidas ❌: "Lácteos y huevos", "Pan y bollería", "Desayuno y cereales" (ES literal). Backend categories.name retorna ES fixo.
- Nomes produto permanecem ES ("Aceite de oliva" etc) — Manager já disse: aguarda decisão user.
- Dev fix: backend `categories` table add `namePt` OR i18n catálogo category slug→i18n key. Produtos deixar como está até Boss decidir.
- Lang switch NÃO derruba sessão nesse teste ✅ (regresso anterior walkthrough resolvido).

**#12 favoritar animation — CONFIRMADO ausente**
- Rota: `/produto/<id>` → click botão coração top-right
- Click aria-label muda "Adicionar aos favoritos" → "Remover dos favoritos" instant.
- Btn CSS tem `transition: transform 0.15s cubic-bezier + active:scale-95` mas `transform=none` pós-click (sem animação persistente).
- Toast role=status existe mas APENAS banner permanente "Confirme seu e-mail" (não gera toast favoritar).
- Fix Dev: adicionar `toast.success('Adicionado aos favoritos')` + Framer Motion heart beat animation 300ms OR CSS keyframe scale(1.3)→scale(1).

---

### Side bugs encontrados durante repro (não listados feedback user mas relevantes)

**Throttler global agressivo em prod** (causa raiz bundle E)
- `strict` throttler ativa silently em `/products?search=...` e `/products/{id}` durante browse normal (não burst). Afeta SSR + client.
- Memory `[[feedback-throttler-named-global]]` confirma override inline não toca `strict`+`write` named throttlers. Padrão S98 e S106 re-emerge.

**Lang switch /perfil derruba sessão (visto walkthrough anterior)**
- Click "Español" em `/perfil` após register → redirect `/login?returnUrl=/perfil`. Session cookie limpo. Re-login sucede mas mostra `Bienvenido` toast enquanto permanece em `/login` (returnUrl `/perfil` gate email verify bloqueia).

**Category chip "Lácteos y huevos" na home → "Error al cargar productos."**
- API `GET /products?category=lacteos-y-huevos` retorna `200 {data:[],total:0}` — catálogo sem produtos categorizados neste slug. Front trata empty como erro vermelho `Error al cargar productos` ao invés de empty state.

---

### Status repro

- #10/#11 ✅ reproduzido 2x, root cause SSR+429 confirmado empírico
- #14 ✅ reproduzido, root cause front engole 429 sem empty state
- #15 ✅ reproduzido (lista perdida pós nav + add silent), root cause cookie cross-site + throttler
- #16 ❌ não reproduzido Chromium 390px (Safari-specific suspeita)

**Próximos bundles paralelo Dev fix**: #7 busca `leche` → "sin sugerencias para Leche" · #4 bottom nav cortada iPhone · #5 email verify Resend dev · #1/#2 lentidão · #3 produto sem foto · #6 i18n PT-BR · #12 favoritar animation.

## Bugs QA S106 (2026-11-18 — PRs #52+#53+#54)

**Escopo:** `GET /products/search` + `ProductPicker` + wizard combo/bundle.

### Bugs encontrados (primeira passada PRs #52+#53)

**P0 — DoD G/W/T #4 falha**
- Rota: `GET /api/v1/products/search`
- Esperado: 21ª request/60s → 429.
- Obtido: 6ª request → 429.
- Causa: `strict` throttler global (5/60s) continua aplicando. `@Throttle({default:{limit:20,ttl:60_000}})` inline só overrida o default; `strict` + `write` seguem vigentes. Mesmo padrão do bug S98.

**P2 — Label stale no wizard combo/bundle**
- Rota: `/alertas/novo` → Combo e Bundle wizards
- Obtido: Label "IDs dos produtos (vírgula ou espaço)" / "IDs de productos (separados por coma o espacio)" mantido do fluxo antigo.
- Campo agora é autocomplete picker (não aceita IDs separados por vírgula/espaço).

### DoD validados primeira passada ✅
- G/W/T 1: `q=leche` → 200 ordenado `cheapestUnitPrice asc`, NULLs no fim (4 queries: pan/leche/pollo/arroz).
- G/W/T 2: `q=''` → 400 "q deve ter no mínimo 2 caracteres".
- G/W/T 3: `q='a'` → 400 mesma msg.
- G/W/T 5: anon (sem Authorization) → 200.

### UI valid primeira passada ✅
- Picker renderiza wizard combo (desktop + mobile 390px).
- Debounce 300ms + min 2 chars.
- Multi-select chips com botão Remover.
- `data-sentry-mask` presente no wrapper.
- i18n ES + PT-BR definidos (`components.productPicker.*`).
- Oversample fix (PR #53) aplicado.

### Resolução — PR #54 merged 2026-11-18 14:28Z

**P0 FIX:** Backend `products.controller.ts` override 3 named throttlers (`default`+`strict`+`write` a 20/60s). Re-test: 20 requests 200 + 21ª 429 ✅.

**P2 FIX:** i18n `alerts.rules.fields.productIds` → PT-BR "Produtos" / ES "Productos". `productIdsPlaceholder` obsoleto removido. UI verificada preview Vercel ambos locales ✅.

**Veredito final S106:** APROVADO ✅ (gate 4 passou pós fix PR #54).

## Bugs QA S133 (2026-11-20 — PR #83)

**Escopo:** Mercadona imgix→Blob pipeline migration (S117 nit). PR #83 branch feat/sprint-133-imgix-blob-migration.

**P0 — CI audit:repos FAIL (regra #6 violada)**
- File: cesta-api/src/modules/catalog-sync/backfill-images.service.ts
- Linhas: L86 (prisma.product.findMany), L138 (prisma.product.findUnique), L203 (prisma.product.update).
- Service acessa Prisma direto; deveria ir via CatalogSyncRepository ou ProductsRepository.
- CI run 44746452701 failed → mergeStateStatus BLOCKED.

**P0 — DoD empírico 'Blob em prod' não verificável**
- Render srv-dbst4muc6qcc73a3opr0 live = commit 5677bea (S132), não S133.
- Prod /produto/[pid] cmwnpxk3u0fdz4bnjjrdjwju1 (Mercadona '3 Bocadillos') ainda serve imgix:
  - 20 imgs prod-mercadona.imgix.net todas com naturalWidth=0/naturalHeight=0 (não carregam).
  - DIA imgs (dia.es) carregam 64x64 OK.
- Bug S117 original ainda presente em prod. S133 fix depende de merge + redeploy.

**P0 — DoD 'CI verde (api+web)' não atendido**
- Web CI pass (2m5s).
- API CI fail (1m0s) no audit:repos.

**Veredito gate 4 S133:** REPROVADO ❌
- Bloqueio #1: CI red impede merge auto.
- Bloqueio #2: Fix arquitetural regra #6 (prisma direto → repository).
- Bloqueio #3: Sem deploy prod, DoD empírico de imagens Blob não testável.

RESOLVIDO 2026-11-20 13:52Z — Dev pushed 47da338 → audit:repos pass → auto-merge squash a340e81 → Render deploy dep-dc04vfm0tbcc73am25o0 live 13:50:26Z.

### Re-teste gate 4 APROVADO ✅
- CI api 1m37s pass + web 1m41s pass + Vercel pass.
- Pipeline Blob operacional: 94+ jobs BackfillImagesProcessor em 200 logs recentes.
- Uploads → `tidhlyad1fb7f4ut.public.blob.vercel-storage.com/products/{id}.jpg`.
- Prod PDP `/produto/cmwnpv7m40e224bnjoq07gj0z` (Langostino cocido) img Blob renderiza nw=640/nh=460 ✅.
- /api/v1/products/featured-deals confirma imageUrl Blob em prod.

### Migração in-place imgix→Blob (não bloqueante)
- Produtos Mercadona antigos (ex cmwnpxk3u0fdz4bnjjrdjwju1 '3 Bocadillos') ainda com imgix nw=0/nh=0.
- Documentado no PR DoD: migração assíncrona, 2-3 crons scanAndBackfill (cron `0 */2 * * *` Europe/Madrid), max 72h.
- Próximo cron 14:00Z.

**Veredito gate 4 S133 final:** APROVADO ✅ (bloqueios anteriores resolvidos; migração legacy follow-up natural).

## Bugs QA S134 (2026-11-20 — PR #84)

**Escopo:** Carrefour ressurreição — remove PUPPETEER_SLUGS flag, ADR 0009 Accepted (opção C: upgrade Render Starter US$ 7/mo).

### Testável agora (pre-upgrade)
- ✅ CI api + web pass.
- ✅ Merged auto 14:05:24Z, commit 1952ca0.
- ✅ Render deploy dep-dc0579g473hc7388k25g live 14:07:11Z.
- ✅ ADR 0009 Status=Accepted + 3 opções documentadas.
- ✅ catalog-sync.processor.ts: SCHEDULE único (replace in place), activeSchedule wrapper removido.

### Hold DoD G1/G2/G4 — aguardando user upgrade Render Starter
- plan Render atual = **free** (verificado via API svc srv-dbst4muc6qcc73a3opr0).
- G1 trigger carrefour ≥50 produtos: HOLD.
- G2 /products count carrefour ≥100: HOLD.
- G4 24h lastSyncedAt carrefour atualiza: HOLD.

### WARNING pre-upgrade — sintoma OOM parcial
- Pós-deploy 14:07:12 AlcampoAdapter: '0 produtos coletados (120/96474 via Puppeteer)'.
- Chromium relaunch 14:07:58.
- Risco P1 esperado: sync Carrefour/Alcampo em free pode crashar (sprint 130 contexto).
- User ciente — upgrade é precondição aceita.

**Veredito gate 4 S134:** APROVADO PARCIAL ✅ (CI+static) / HOLD empírico G1-G4 pending upgrade.

## Bugs QA S134-revisada (2026-11-20 — PR #85)

**Escopo:** ADR 0009 pivot opção A ScrapingBee. Puppeteer deletado. Supersede PR #84.

### P0 — Render env vars CORROMPIDO
- Service `srv-dbst4muc6qcc73a3opr0` env atual (21 vars): só SCRAPINGBEE_API_KEY + JWT_*_EXPIRES_IN + VAPID + SENTRY + WEB_URL + REVALIDATE_SECRET + RESEND + BLOB_READ_WRITE_TOKEN + JWT_*_PREVIOUS/CURRENT + TWO_FACTOR_ENC_KEY + AUTO_SYNC_ON_BOOT.
- **Faltam:** DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, NODE_ENV, outros essenciais.
- Build deploy `dep-dc05q2ec6qcc73f0odhg` (commit 35c53fe) FAIL 14:46:18: Prisma P1012 'Environment variable not found: DATABASE_URL'.
- Causa provável: Manager fez PUT /env-vars (substitui set inteiro) ao invés de POST (adiciona um), apagou vars antigas ao provisionar SCRAPINGBEE_API_KEY.

### Status prod
- Serving ainda PR #84 (1952ca0 `dep-dc0579g473hc7388k25g` live) via rollback automático pós-build-fail.
- Health 200 OK. /api/v1/products OK.
- **Risco iminente:** próximo restart service fail por DATABASE_URL missing. Service com env runtime da boot de 14:07; novo spin = quebra.

### DoD G1-G4 HOLD
- G1 trigger carrefour: HOLD (PR 85 não deployed).
- G2 /products count carrefour ≥100: HOLD.
- G4 24h lastSyncedAt: HOLD.
- G3 ADR 0009 Status=Accepted opção A ✅ (único validável static).

**Veredito gate 4 S134-r PR#85:** APROVADO PARCIAL ✅ pós env restore / HOLD G1/G2 (ver PR#86).

## Bugs QA S134-r² (2026-11-20 — PR #86 fix-forward)

**Escopo:** P1 manual-sync priority=1 + P2 errorMessage persist em failure paths.

### Validado static ✅
- CI api + web pass 16:05Z.
- Merge auto 16:06:02Z commit 4848fd8.
- Render deploy dep-* live 16:07Z.
- Spec jest 336/336.

### HOLD G1/G2 empírico ❌
- Trigger 16:08:07Z: POST /api/v1/admin/catalog-sync/carrefour/run → 202 jobId=428 + alcampo/run → 202 jobId=429.
- 15min+ depois: ZERO logs CatalogSyncProcessor pra carrefour ou alcampo.
- Processor rodou dia/lidl/aldi/mercadona (repeat crons) normalmente no mesmo período (16:11:18+).
- Manual-sync jobs 428+429 NUNCA consumidos — fix priority=1 não teve efeito observável.
- Latest SyncRun carrefour=13:32 (failed, errorMessage=null), alcampo=14:23 (failed, errorMessage=null) — PRÉ-triggers.
- Products carrefour=27, alcampo=27 inalterado.

### Hipótese Dev deve investigar
- catalog-sync.processor.ts @Processor matcha qualquer name? Ou precisa @Process('manual-sync') explicit handler?
- Priority=1 setado em controller mas worker config pode não ordenar.
- BullMQ job 'manual-sync' name talvez dropped antes consumo.

**Veredito gate 4 PR#86:** HOLD ❌ — priority só muda ordem de pick, não preempta slot (resolvido em PR#87).

## Bugs QA S134-r³ (2026-11-20 — PR #87 2ª iter)

**Escopo:** Queue dedicada CATALOG_SYNC_MANUAL_QUEUE separada de cron queue.

### Validado empíricamente ✅
- Deploy e07eef6 LIVE 16:27Z.
- POST alcampo/run → 202 jobId=1 → pick <200ms (16:27:20.700→20.864Z) ✅
- POST carrefour/run → 202 jobId=2 → pick similar ✅
- CatalogSyncManualProcessor consome imediato, não aguarda cron queue (Mercadona 24min não bloqueia mais).

### P1 priority: ✅ FIXED
### P2 errorMessage: ✅ FIXED
- SyncRun carrefour cmwp6zojq007g2c43cxxd6fzy failed 16:29:13Z, errorMessage='Carrefour: 0 produtos coletados em 20 queries · últimos erros: aceite oliva: ScrapingBee retornou 500: ...'

### ScrapingBee pipeline ativo
- Logs ScrapingbeeFetch fetch ok status=200 cost=5 bytes=6xx (alcampo 100+ fetches 16:42-16:43).
- Cost=5/call (render_js basic sem premium, bate PR#85 docs).

### DoD G1/G2
- G1 alcampo ≥50 produtos novos: EM ANDAMENTO (27→54 em ~15min, sync still running).
- G1 carrefour ≥50: FAIL ESPERADO (ScrapingBee 500 todas 20 queries, documentado PR#86 probe inline).
- G2 count alcampo ≥100: EM ANDAMENTO.
- G2 count carrefour ≥100: NÃO ATENDÍVEL (Carrefour broken, PR só torna visível). Requer nova estratégia (S135 backlog).
- G3 ADR 0009 Accepted ✅.
- G4 24h: aguardar natural.

**Veredito gate 4 PR#87:** APROVADO ✅ (fix queue dedicada empíricamente validado; Carrefour fail documentado é expected behavior, backlog S135).

## S180 backlog (Reviewer nit S179 + QA G1 FAIL 2026-11-26)

**Escopo S180:** fix fuzzy typo backend + ADR 0012 formal.

**QA G1 FAIL empírico prod S179 PR #136:**
- q='lecge' → 0 results (expected: match 'Leche')
- q='yogrt' → 0 results (expected: match 'Yogur')
- q='yoguer' → 0 results (expected: match 'Yogur')
- Root cause: Fuse post-fetch só re-ranks array backend. Backend ILIKE sem fuzzy → 0 matches → Fuse sem dataset pra tolerar typo.

**Fix opts:**
- **A (preferred):** Postgres pg_trgm extension + GIN index em products.name. Backend /products/suggest aceita fuzzy via similarity() > 0.3. ADR 0012 doc trade-offs. Migration prisma + extension(['pg_trgm']).
- B: Frontend pré-fetch top N (ex 500) produtos mais populares cache client, aplicar Fuse offline independente backend. Trade-off bundle + staleness.
- C: Documenta limitation (rejeitado — feature promete typo tolerance QA FAIL).

**DoD esperado:**
- G1: migration prisma pg_trgm extension + GIN index products.name
- G2: /products/suggest aceita fuzzy via similarity threshold >0.3
- G3: ADR 0012 docs/adr/0012-search-fuzzy-strategy.md (formal LOUD + opt A escolhido)
- G4: QA regression: q='lecge' → match Leche prod; q='yogrt' → match Yogur
- G5: CI verde api+web

---

## Bugs QA S214 (2026-11-27)

**Contexto:** gate 4 empírico prod pós S213 deploy LIVE (commit 40e67be 22:49:42Z). 27 sprints S187-S213 catch-up. Portais Cesta Web (1920x1064) + Cesta Mobile (390x844). Idiomas ES+PT-BR.

**Fluxos testados:**
1. ✅ Home / → busca fuzzy "aceit" → listbox 8 opções sugeridas (desktop+mobile)
2. ✅ /produto/[pid] (Aceite Hacendado 0,4º) → img, preço, gráfico 30/60/90d, review form estrelas+textarea+filter select Recentes/Útiles/Nota, breadcrumb back
3. ❌ **/comparar?products=X — BUG P0** ver abaixo
4. ✅ /favoritos → add via home card botão → aparece lista → remover via diálogo Cancelar/Confirmar
5. ✅ /gastos empty state → botões "Escanear nota" + "Subir imagem" presentes (upload não executado, requer worker)
6. ✅ /alertas → "Nova regra" → wizard 3 tipos Combo/Tendência/Economia → Combo: autocomplete produto (listbox options após "aceite") + input Total alvo
7. ✅ /minha-lista → criar lista "QA S214 Lista" → modal "Adicionar produto" com listing produtos → add 1 Bocadillos → item renderiza com -/+/remover
8. ✅ /minha-cesta/configurar wizard 5 etapas (preferências, perguntas 7x Sim/Não, restrições, orçamento 300€, gerar) → /minha-cesta com items renderizados + botões Fixar/Obrigatório/Substituir/Excluir + Regerar
9. ✅ /perfil → toggle ES ↔ PT-BR (title "Mi cuenta"↔"Minha conta", banner "Confirma tu email"↔"Confirme seu e-mail") + logout → redireciona /login

**Regression S186:**
- Reviews filter presente ✅ (select Recentes/Mais úteis/Melhor nota/Pior nota + checkbox "Só com comentário")
- Cesta wizard presente ✅ 5 etapas completas
- Bottom-nav presente ✅ (Início/Minha lista/Favoritos/Comparar/Conta)
- Coral tokens: cor primária aparente screenshots é verde-oliva + bege/creme; não identificado rose residual

**Backend:**
- GET /api/v1/supermarkets → 8 slugs ativos (alcampo, aldi, carrefour, dia, eroski, froiz, lidl, mercadona) ✅
- LIDL produtos existem (ex. ALESTO Mix de frutos secos cmwxjjnf700unbmp29cevzn09 price 4.99€)
- Home "Melhores ofertas" mostra só Mercadona (menor preço) — by design

---

### BUG P0: /comparar?products=X spinner infinito

**Rota:** `/comparar?products=<cuid>`
**Esperado:** matriz de comparação (preços + nutrição + nome + mercado) renderizada p/ produtos selecionados
**Obtido:** spinner verde permanece >30s, body vazio (só back button + "1/4" counter + bottom-nav se logado)
**Repro:**
1. Nav `/comparar`
2. Click "Adicionar produto" → modal abre (produtos listados OK)
3. Click qualquer produto (ex. "3 Bocadillos" cmwnpxk3u0fdz4bnjjrdjwju1)
4. URL atualiza p/ `?products=<id>`, counter top-right "1/4"
5. Body permanece com spinner indefinido

**Repro cross-cuts:**
- Web desktop (1920x1064) ✅ repro
- Mobile (390x844) ✅ repro
- Logged in ✅ repro
- Logged out ✅ repro

**Backend saudável:**
- GET /api/v1/products/cmwnpxk3u0fdz4bnjjrdjwju1 → 200 OK, data.name="3 Bocadillos"
- GET /api/v1/products/cmwnyj03g0gji28gp2pbqmfmr → 200 OK data completa

**Conclusão:** bug é no frontend /comparar page (component fetch/render), não backend.

**Screenshots:**
- C:\Users\gabri\AppData\Local\Temp\maestri-portal-08ff36e9-c2c2-4bbc-8bd5-ad1f52f5ae22.png (web logged out)
- C:\Users\gabri\AppData\Local\Temp\maestri-portal-f92d871a-a75c-480b-bddc-01814712c857.png (web logged in)
- C:\Users\gabri\AppData\Local\Temp\maestri-portal-6e580e68-4758-4dae-b360-14b12d209065.png (persistência >25s)

**Veredito gate 4 S213 deploy LIVE:** REPROVA (P0 comparar matriz quebrada).
