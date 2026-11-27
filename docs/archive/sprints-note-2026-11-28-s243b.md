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
2. Dev implementa, commita, abre PR via `gh pr create`, PR SEM auto-merge (Boss 2026-11-27) · Reviewer arma `gh pr merge --auto --squash --delete-branch` em gate 3 APROVADO. Atualiza **Status dev**, **ping Reviewer + QA em paralelo**
3. Reviewer testa código, escreve **Revisão** (APROVADO ou PEDIDOS DE AJUSTE), **ping Manager OU Dev**
4. **QA Tester** reexecuta fluxos nos 2 viewports **em URLs produção** (gate UX), **ping Manager OU Dev**
5. **DoD duplo**: só avança com Reviewer + QA Tester aprovando
6. Sprint fechada: Manager move pra **Histórico**
7. **Auto-/clear cascade (token economy)**: Manager verifica Dev/Reviewer/QA idle (sem ask pendente 2min), dispara `/clear` via maestri-batch helper. Manager NÃO limpa a si mesmo.
8. Manager publica próxima sprint + **ping Dev imediato** kickoff

> **Regras CLAUDE.md**: sem polling se event-driven existe; replace in place sem v2/fallback. **4 .md fonte verdade releitura antes de cada sprint nova.** Design tokens só cesta-identidade-visual.md. **GDPR mask PII em novos componentes (Sprint 59 rule permanente).**

> **Anti-deadlock (2026-11-16):** silêncio NÃO é aceitável. Quem termina DEVE pingar próximo via `maestri ask` IMEDIATAMENTE. Cold start Render ~30s NÃO justifica travar — esperar + check periódico.

> **⚠️ REGRA DE ESCRITA (Boss 2026-11-25):** `note write` SUBSTITUI a nota inteira e NÃO tem flag `--append`. Pra adicionar: `maestri note edit "Cesta — Sprints" "<âncora>" "<âncora + texto novo>"`.

## Arquivo
- Histórico S1-S133: `docs/archive/sprints-note-2026-11-20.md`.
- S134-S169: ver `CHANGELOG.md` + `pendente-note-2026-11-27.md` + git log (PRs #84-#125).
- Histórico S170-S204 (snapshot 2026-11-26): `docs/archive/sprints-note-2026-11-26.md`.
- Histórico S205-S224 (snapshot 2026-11-27 pós-S224): `docs/archive/sprints-note-2026-11-27.md`.
- **Histórico S225-S227 + rawold-sprints (snapshot 2026-11-27 pós-S227/pré-S228): `docs/archive/sprints-note-2026-11-27-b.md`.**
- **Snapshot nota Sprints pós-S228/pré-S229 (2026-11-27): `docs/archive/sprints-note-2026-11-27-s229.md`.**
- **Snapshot nota Pendente pós-S228/pré-S229 (2026-11-27): `docs/archive/pendente-note-2026-11-27-s229.md`.**
- **Snapshot nota Sprints pós-S229/pré-S230 (2026-11-27): `docs/archive/sprints-note-2026-11-27-s230.md`.**
- **Snapshot nota Pendente pós-S229/pré-S230 (2026-11-27): `docs/archive/pendente-note-2026-11-27-s230.md`.**
- **Snapshot nota Sprints pós-S231/pré-S232 (2026-11-27): `docs/archive/sprints-note-2026-11-27-s232.md`.**
- **Snapshot nota Pendente pós-S231/pré-S232 (2026-11-27): `docs/archive/pendente-note-2026-11-27-s232.md`.**
- **Snapshot nota Sprints pós-S232/pré-S233 (2026-11-27): `docs/archive/sprints-note-2026-11-27-s233.md`.**
- **Snapshot nota Pendente pós-S232/pré-S233 (2026-11-27): `docs/archive/pendente-note-2026-11-27-s233.md`.**
- **Snapshot nota Sprints pós-S233/pré-S234 (2026-11-27): `docs/archive/sprints-note-2026-11-27-s234.md`.**
- **Snapshot nota Pendente pós-S233/pré-S234 (2026-11-27): `docs/archive/pendente-note-2026-11-27-s234.md`.**
- **Snapshot nota Sprints pós-S234/pré-S235 (2026-11-27): `docs/archive/sprints-note-2026-11-27-s235.md`.**
- **Snapshot nota Sprints pós-S235/pré-S236 (2026-11-27): `docs/archive/sprints-note-2026-11-27-s236.md`.**
- **Snapshot nota Sprints pós-S236/pré-S237 (2026-11-27): `docs/archive/sprints-note-2026-11-27-s237.md`.**
- **Snapshot nota Sprints pós-S237/pré-S238 (2026-11-27): `docs/archive/sprints-note-2026-11-27-s238.md`.**
- **Snapshot nota Sprints pós-S238/pré-S239 (2026-11-27): `docs/archive/sprints-note-2026-11-27-s239.md`.**
- **Snapshot nota Sprints pós-S239/pré-S240 (2026-11-27): `docs/archive/sprints-note-2026-11-27-s240.md`.**
- **Snapshot nota Sprints pós-S240/pré-S241 (2026-11-27): `docs/archive/sprints-note-2026-11-27-s241.md`.**
- **Snapshot nota Sprints pós-S241/pré-S242 (2026-11-27): `docs/archive/sprints-note-2026-11-27-s242.md`.**
- **Snapshot nota Sprints pós-S242/pré-S243 (2026-11-27): `docs/archive/sprints-note-2026-11-27-s243.md`.**
- **Snapshot nota Pendente pós-S234/pré-S235 (2026-11-27): `docs/archive/pendente-note-2026-11-27-s235.md`.**
- **Snapshot nota Pendente pós-S235/pré-S236 (2026-11-27): `docs/archive/pendente-note-2026-11-27-s236.md`.**
- **Snapshot nota Pendente pós-S236/pré-S237 (2026-11-27): `docs/archive/pendente-note-2026-11-27-s237.md`.**
- **Snapshot nota Pendente pós-S237/pré-S238 (2026-11-27): `docs/archive/pendente-note-2026-11-27-s238.md`.**
- **Snapshot nota Pendente pós-S238/pré-S239 (2026-11-27): `docs/archive/pendente-note-2026-11-27-s239.md`.**
- **Snapshot nota Pendente pós-S239/pré-S240 (2026-11-27): `docs/archive/pendente-note-2026-11-27-s240.md`.**
- **Snapshot nota Pendente pós-S240/pré-S241 (2026-11-27): `docs/archive/pendente-note-2026-11-27-s241.md`.**
- **Snapshot nota Pendente pós-S241/pré-S242 (2026-11-27): `docs/archive/pendente-note-2026-11-27-s242.md`.**
- **Snapshot nota Pendente pós-S242/pré-S243 (2026-11-27): `docs/archive/pendente-note-2026-11-27-s243.md`.**
- Protocolo de bastão: nota `Cesta — Loop`.

---

## Sprint ativa
**S243b URGENTE fix listagem exclui produtos sem preço ativo (Boss 2026-11-27 23:xx pós cleanup-seed-prices --apply)**.

**Contexto**: Boss executou cleanup-seed-prices --apply (user autorizou direção A ADR 0042 ACCEPTED + gravação prod). **189 preços seed soft-deletados** (27 produtos × 7 mercados) · PITR UTC 2026-11-27T23:02:43Z · rollback SQL registrado.

**DEFEITO VISÍVEL prod**: 27 produtos seed continuam aparecendo em GET /products?search= e /products/search com prices []. Ex: 'Leche entera brik 1L' (Hacendado) com prices=[].

**Fix** (TOPO S243b · deploy rápido):
- Listagem (findMany) + search (findForSearch) + suggest (findSuggestions) excluem produto sem preço ativo (prices.where { isAvailable=true, deletedAt=null }).
- Produto sem price ativo = não aparece em UI pública.
- Produto detalhe (/products/:id) PRESERVA comportamento atual (debug/admin).
- Teste unit + QA empírico prod (search 'Leche entera brik' NÃO retorna produtos sem preço).

**Guardas**:
- Zero schema change.
- Backwards-compat API params.
- G0 archive pointers.
- 4 .md gate normal.
- Spec coverage.

**Branch**: fix/s243b-exclude-products-no-active-price.
**PR SEM --auto**. Reviewer arma gate 3 APROVADO.

---

**S244 P0 "MESMO PRODUTO" (Boss plano pós S243b · SDD-lite completo)**:
- Variant gate ganha tokens de público: men/hombre/mujer/women/kids/infantil/bebe + fixture caso Nivea (Nivea Men vs Nivea normal · match-cluster dry-run 2026-11-27 juntou errado).
- Read path: detalhe produto + /comparar agregam preços grupo canônico. Busca mostra 1 card por grupo. Selo verde 'mesmo produto'.
- SDD-lite: OpenAPI yaml + G/W/T DoD + ADR.
- Fechamento: Dev dry-run full · QA sample 30 clusters erro ≤5% · Boss --apply (user autorizou terminal Boss · classifier bloqueia outros). Ping Boss count final.

**S245 P0 "EQUIVALENTE" piloto 5 categorias (ADR 0042 ACCEPTED pós user direção A)**:
- Categorias: leite · água · ovos · azeite · pão.
- Mesmo tipo + tamanho · marcas diferentes (ex: leite inteiro 1L Hacendado × Dia Lactea × Milsani).
- Selo amarelo 'equivalente mais barato'.
- População dados prod pelo Boss (user autoriza terminal Boss).

---

**Chain prod executado 2026-11-27 23:02:43Z UTC**:
- ✅ cleanup-seed-prices --apply: 189 preços seed soft-del (27 prod × 7 mercados). PITR registrado. Rollback SQL: UPDATE product_prices SET deleted_at = NULL WHERE deleted_at IS NOT NULL AND source = 'seed'.
- ❌ match-cluster --apply VETADO Boss: Nivea Men × Nivea normal (Black and White Invisible 200ml + roll-on 50ml · Mercadona + DIA) erro 2/12 clusters > 5%. canonicalProductId não lido em read path products (linkar não muda tela sem S244).

---

**P1 restante backlog**:
- S241 QA achou Eroski 100% stale sync fix (S246 · pós S244+S245).

**P3 restante backlog**:
- 2 nits S237 (exact-size boost ranking + rota /busca decisão).
- UptimeRobot externo (follow-up S236).
**S243 GRACEFUL SHUTDOWN OCR + TOKEN REFRESH FLOW (Boss 2026-11-27 pós S240 diagnóstico)**.

**(1) Graceful shutdown OCR** (bug real evidenciado Render logs 22:39:46Z):
- Instance bhh5b já em shutdown RE-inicializou Tesseract 2704ms DEPOIS onModuleDestroy → job upload #2 perdido.
- Fix: fechar worker BullMQ ANTES terminar Tesseract · bloquear lazy re-init pós destroy · job ativo volta fila (stalled retry instance nova).
- Unit test destroy com job em andamento.

**(2) Token refresh flow upload** (regressão parcial S228 #15 · P1):
- Upload ticket passa mesmo fluxo axios 401/refresh/retry (reusar auth interceptor).
- Se refresh falhar · redirect login + msg 'Sessão expirada' · NUNCA 'Token ausente'.
- E2E simulando access token expirado · upload tenta · refresh fail · redirect.

**Guardas**:
- Zero schema change.
- Spec coverage unit (shutdown + token).
- E2E simulating expired session.
- G0 archive pointers.
- 4 .md gate normal.

**Branch**: fix/s243-ocr-graceful-shutdown-token-refresh.
**PR SEM --auto**. Reviewer arma gate 3 APROVADO.

---

**S244 fila próxima**: Eroski 100% stale sync fix (S241 QA achou 100% stale Eroski prod sample 50) · investigar cron Eroski (não dispara? parse fail? EAN extração fail já visto S224 image coverage?) · fix.

---

**Chain paralelo pendente Boss**:
- Diagnostics prod matching (4 scripts) + --apply condicional.
- S242 #224 gate 4 QA (Vercel rate-limit pode delay).

**P3 restante backlog**:
- 2 nits S237 (exact-size boost ranking + rota /busca decisão).
- UptimeRobot externo (follow-up S236).
**S243 fila após S242 (Boss 2026-11-27)** — BUG S240 REAL: graceful shutdown OCR + token refresh flow.

**Scope**:

**(1) Graceful shutdown OCR** (bug real evidenciado Render logs 22:39:46Z):
- Instance bhh5b já em shutdown RE-inicializou Tesseract 2704ms DEPOIS onModuleDestroy → job upload #2 perdido.
- Fix: fechar worker BullMQ ANTES terminar Tesseract · bloquear lazy re-init pós destroy · job ativo volta fila (stalled retry instance nova).
- Unit test destroy com job em andamento.

**(2) Token ausente sessão expirada** (regressão parcial S228 #15 · P1):
- Upload ticket passa mesmo fluxo axios 401/refresh/retry.
- Se refresh falhar · redirect login + msg 'Sessão expirada' · NUNCA 'Token ausente'.
- E2E simulando access token expirado · upload tenta · refresh fail · redirect.

**Guardas** (herdadas):
- Zero schema change.
- Spec coverage unit (shutdown + token).
- G0 archive pointers.
- 4 .md gate normal.

**Branch**: fix/s243-ocr-graceful-shutdown-token-refresh.
**PR SEM --auto**. Reviewer arma gate 3 APROVADO.

---

**S242 P2 bundle polish #5 toast + #8 logos mercados** — Dev em curso (kickoff disparado).

**#5 toast**: 'X adicionado a Y' on-add product to list.
**#8 logos**: SupermarketBadge com img + fallback texto.

**Branch**: feat/s242-toast-adicionar-logos-mercados.

---

**Chain paralelo pendente Boss**:
- Diagnostics prod matching (4 scripts) + --apply condicional.
- S241 #223 gate 4 QA empírico.

**P3 restante backlog**:
- 2 nits S237 (exact-size boost ranking + rota /busca decisão).

**P4 backlog**:
- UptimeRobot externo (follow-up S236).
**S242 P2 bundle polish #5 toast + #8 logos mercados (frontend-only scope pequeno)**.

**#5 toast**: ao adicionar produto à lista (botão 'Adicionar à lista' em busca / detalhe / modal), mostrar toast 'X adicionado à lista Y' (nome produto + nome lista). Atualmente ação silenciosa.

**#8 logos mercados**: badges mercado atualmente mostram texto curto (ex 'ME' para Mercadona · 'AL' para Alcampo). Substituir por logos reais quando disponível · fallback texto se logo não carrega.

**Fix (frontend scope)**:

**#5 toast**:
- Reuse sistema toast existente (sonner/toaster já instalado).
- Hook `useAddToList` ou equivalente · chama toast on success.
- Mensagem: `${productName} adicionado a ${listName}` (i18n es+pt-BR).
- Timeout 3s default · dismissible.

**#8 logos**:
- Pasta `public/supermarkets/<slug>.svg` OR `.png` (logos Mercadona/DIA/LIDL/Eroski/Froiz/Aldi/Carrefour/Alcampo).
- Component `<SupermarketBadge slug={slug} />` · `<img src="/supermarkets/<slug>.svg" alt={supermarketName} onError={fallbackText}>`.
- Fallback texto 2 letras se logo não carrega.
- Breakpoints: icon-only mobile · icon+nome desktop.

**Guardas**:
- Zero schema/backend change.
- Logos: usar logos públicos oficiais OR placeholders simples se não disponível (Dev decide · documenta source em ADR 0043 ou PR body).
- G0 archive pointers.
- 4 .md gate normal.
- Spec coverage toast on-add + SupermarketBadge render+fallback.
- Identidade-visual tokens preservados.

**Branch**: feat/s242-toast-adicionar-logos-mercados.
**PR SEM --auto**. Reviewer arma gate 3 APROVADO.

**Chain paralelo pendente Boss**:
- Diagnostics prod matching (4 scripts) + --apply condicional.
- S240 OCR gate 4 + S241 badge gate 4 (QA empírico).
- S241 Fase 3 fix adapter específico (defer S243 pós Boss audit).

**P3 restante backlog**:
- 2 nits S237 (exact-size boost ranking + rota /busca decisão).
- UptimeRobot externo (follow-up S236).

**P0 chain matching**:
- Pendente Boss executar diagnose-match-test-set + audit-national-brand-ceiling + cleanup-seed-prices + match-cluster rerun · depois decisão --apply.
**S241 P1 #6 badge DESACTUALIZADO sync falhando (backend investigation + fix)**.

**Bug**: UI mostra badge 'DESACTUALIZADO' quando ProductPrice.isStale=true (preço > X horas sem update pelo adapter · definido em catalog-sync). User quer **preço sempre em dia** · CORRIGIR SYNC FALHANDO (identificar qual mercado + por quê) · **NÃO esconder badge**.

**Escopo S241**:

**(1) Diagnóstico**: query prod read-only. Agrupar ProductPrice por supermarket onde isStale=true · percentual stale por adapter · lastSyncAt distribution. Identificar outliers:
- Mercadona/DIA/LIDL/Eroski/Froiz/Aldi crons falhando?
- Carrefour/Alcampo frozen (pós-MVP · esperado).
- Error patterns em logs (BullMQ catalog-sync processor).

**(2) Fix sync falhando** per adapter identificado:
- Se cron schedule não dispara: verificar BullMQ scheduler + cron expression + timezone.
- Se adapter error: log root cause (403? parse fail? timeout?).
- Fix por adapter OR retry policy + alerting se falha persistente.

**(3) Métrica**:
- Baseline: % produtos isStale per adapter.
- Pós-fix: % stale cai significativamente (target <5% por adapter ativo).
- Script: scripts/audit-stale-prices.mjs novo read-only.

**Guardas**:
- Zero schema change (apenas query ordering · OR adiciona pg trgm rank helper).
- Backwards-compat API.
- G0 archive pointers.
- 4 .md gate normal.
- Spec coverage adapters afetados.

**Branch**: fix/s241-badge-desactualizado-sync-falhando.
**PR SEM --auto**. Reviewer arma gate 3 APROVADO.

**Chain paralelo pendente Boss**:
- Diagnostics prod matching (4 scripts) + --apply condicional.

**P1 restante backlog**:
- 2 nits P3 S237 (exact-size boost + rota /busca decisão).

**P2**:
- #5 toast · #8 logos · UptimeRobot externo (follow-up S236).
**S240 P1 #14 OCR Mercadona lento (backend/worker scope)**.

**Bug**: upload nota Mercadona · OCR demora excessivamente (user reportou). Fluxo: POST /receipts → BullMQ job receipts → worker OCR (Tesseract.js OR serviço externo) → parse items → persist. Latência percebida > 30s em alguns casos.

**Fix esperado** (3 pontos · validar via trace):
1. **Benchmark atual**: instrumentar worker OCR (log inicio/fim + duração) em dev/prod. Identificar bottleneck: fetch imagem R2? Tesseract init? OCR runtime? Parse regex?
2. **Otimizações potenciais**:
   - Lazy-load Tesseract worker (reuse entre jobs em vez de init cada vez).
   - Image preprocess (resize/grayscale/threshold antes OCR · acelera Tesseract).
   - Timeout agressivo + retry com queue priority.
   - Opção: trocar Tesseract → serviço externo (Google Vision · AWS Textract · free tier) se Tesseract não escalar.
3. **UX melhor feedback**: toast 'Processando ticket...' + progress se worker expõe · fallback 'Pode demorar alguns minutos'.

**Procedimento**:
1. Trace local: upload imagem Mercadona teste · log durações cada stage.
2. Decidir otimização (lazy Tesseract OR preprocess OR serviço externo).
3. Implementar + spec coverage.
4. Deploy + validar duração prod (benchmark antes vs depois).

**Guardas**:
- Zero schema change (apenas worker logic).
- Backwards-compat API (/receipts endpoint intacto).
- G0 archive pointers.
- 4 .md gate normal.
- Spec coverage worker OCR.

**Branch**: fix/s240-ocr-mercadona-latency.
**PR SEM --auto**. Reviewer arma gate 3 APROVADO.

**Chain paralelo pendente Boss**:
- Diagnostics prod matching (4 scripts) + --apply condicional.

**P1 restante backlog**:
- #6 badge DESACTUALIZADO sync falhando.
- 2 nits P3 S237 (exact-size boost + rota /busca decisão).

**P2**:
- #5 toast · #8 logos · UptimeRobot externo (follow-up S236).
**S239 P1 #12+#13 /comparar multi-select + tabela mobile (bundle web-only)**.

**Bug #12**: /comparar multi-select NÃO é persistente entre buscas. User seleciona 3 produtos · faz nova busca · seleção perdida. Esperado: seleção acumula até user clicar 'Comparar' OR limpar explicitamente.

**Bug #13**: /comparar tabela em mobile é ilegível. Colunas cortadas · texto overflow · swipe horizontal confuso. Esperado: layout mobile-friendly (cards stacked OR horizontal scroll com indicator visível).

**Fix (frontend scope)**:

**#12 multi-select persistência**:
- Zustand store compareStore (já existe?) OR novo · lista [productId] persistida em localStorage.
- Search state separado de compare state · selection survive navigation.
- Badge count no header /comparar durante navegação (ex: 'Comparar (3)').
- Botão 'Limpar seleção' explicit.

**#13 tabela mobile**:
- Breakpoint mobile <= 640px: layout stack cards por produto (ou grid 2-col).
- Breakpoint tablet 641-1023px: horizontal scroll + sticky coluna produto · snap indicators.
- Breakpoint desktop >= 1024px: tabela tradicional preserved.
- Testar legibilidade em 390px (iPhone standard).

**Guardas**:
- Zero schema change · zero backend change.
- G0 archive pointers.
- 4 .md gate normal.
- Spec coverage store + render responsive.
- Identidade-visual tokens preservados.

**Branch**: fix/s239-comparar-multiselect-tabela-mobile.
**PR SEM --auto**. Reviewer arma gate 3 APROVADO.

**Chain paralelo pendente Boss**:
- Diagnostics prod matching (4 scripts) + --apply condicional.

**P1 restante backlog**:
- #14 OCR Mercadona lento.
- #6 badge DESACTUALIZADO sync falhando.
- 2 nits P3 S237 (exact-size boost + rota /busca decisão).

**P2**:
- #5 toast · #8 logos · UptimeRobot externo (follow-up S236).
**S238 P1 #3+#4 busca dentro lista (completa UX busca pós-S237)**.

**Bug #3**: busca dentro de Minha Lista retorna resultados SEM fotos (thumbs vazias). Esperado: card com image preview ou placeholder visível.

**Bug #4**: busca dentro de Minha Lista · toque no produto NÃO abre tela de detalhe. Esperado: navegação pra /produto/[id].

**Fix (frontend scope)**:
1. Componente busca em /minha-lista/[id]: adicionar img tag src product.imageUrl fallback no card de resultado (consistência com home search).
2. Toque no card → router.push /produto/ + product.id (link Next.js).
3. Spec frontend render + click handler.
4. Verificar não quebra fluxo adicionar à lista (botão adicionar separado).

**Guardas**:
- Zero schema change · zero backend change.
- G0 archive pointers.
- 4 .md gate normal.
- Spec coverage card component.

**Branch**: fix/s238-busca-lista-fotos-detalhe.
**PR SEM --auto**. Reviewer arma gate 3 APROVADO.

**Chain paralelo pendente Boss**:
- Diagnostics prod (diagnose-match-test-set + audit-national-brand-ceiling + cleanup-seed-prices + match-cluster rerun).
- --apply chain condicional pós métrica.

**P1 restante backlog**:
- #14 OCR Mercadona lento.
- #6 badge DESACTUALIZADO sync falhando.
- #12/#13 /comparar multi-select + tabela mobile.

**P2**:
- #5 toast · #8 logos · UptimeRobot externo (follow-up S236).
**S237 P1 #2 ranking busca frase/categoria antes de preço (Boss 2026-11-27 · NÃO defer · absorve nit S228 #207)**.

**Bug**: busca Enter/seta vai direto 1º produto (não tela resultados). Ordenação default não prioriza exact-match semântico. Ex: 'leche entera' first result é 'Chocolate con leche Hacendado almendras enteras' em vez de 'Leche entera brik 1L'.

**Fix (2 pontos)**:
1. **Enter/seta busca → tela resultados**: redireciona pra /busca?q=<term> em vez de abrir 1º produto. Keyboard Enter OR seta pra baixo + Enter OR botão submit.
2. **Ranking por match de frase/categoria ANTES de preço**:
   - Score query vs name: phrase match exato (no início) > phrase match (meio) > todos tokens (AND) > subset tokens (OR).
   - Secondary score: category match (query tokens match category name).
   - Tertiary: preço ascendente (default atual).
   - PostgreSQL: use ts_rank OR calculated score column + ORDER BY score DESC, price ASC.

**Spec test fixo (regression)**:
- 'leche entera' → 1º 'Leche entera brik 1L Hacendado' (not 'Chocolate con leche almendras enteras').
- 'coca cola zero' → 1º 'Coca-Cola Zero 2L' OR similar exact.
- 'oreo' → 1º 'Oreo Original' (not 'Galletas rellenas sabor Oreo') se exact-brand existir.

**Guardas**:
- Zero schema change (apenas query ordering · OR adiciona pg trgm rank helper).
- Backwards-compatible: API params existentes (search, supermarket, limit) seguem.
- G0 archive pointers.
- 4 .md gate normal.

**Branch**: fix/s237-busca-ranking-frase-categoria.
**PR SEM --auto**. Reviewer arma gate 3 APROVADO.

**Chain paralelo pendente Boss**:
- Diagnostics prod (diagnose-match-test-set + audit-national-brand-ceiling + cleanup-seed-prices).
- Decisão --apply match-cluster + mercadona-backfill + canonical.

**P1 backlog próximas**:
- #14 OCR Mercadona lento.
- #6 badge DESACTUALIZADO sync falhando.
- #3/#4 busca dentro lista.
- #12/#13 /comparar multi-select + tabela mobile.

**P2**:
- #5 toast · #8 logos.

## Fechamentos recentes (append conforme gates)

**S243 #225 Gate 3 APROVADO · auto-merge armed · CI running** — PR fix OCR graceful shutdown + upload 401 refresh flow. (1) OCR graceful shutdown: destroyed flag set topo onModuleDestroy antes await · 3 checkpoints extract (entry+post-preprocess+post-boot) + guard getOrCreateWorker · OcrServiceDestroyedError exportado com name próprio pra BullMQ log · throw propaga → attempts/backoff retry instance saudável. (2) Upload 401: ApiError.statusCode===401 → setAccessToken(null)+clearAuth+toast sessionExpired+router.push /login?returnUrl=%2Fgastos · demais erros (incluindo 429) preservados. i18n sessionExpired es+pt-BR. Specs 14/14 OCR (+4 shutdown) + 4/4 use-expenses (+2 cobre 401 happy + 500 skip + assert negativo nunca 'Unauthorized'/'Token ausente'). Zero schema/backend endpoint. Sentry preservada. G0 s243 archive + 4 .md OK.

**S242 #224 ✅ MERGED · Gate 3 APROVADO · Gate 4 APROVADO empírico prod cesta-web (deploy 1ebc0e8 LIVE)** — PR feat(web) bundle polish #5 toast + #8 logos mercados. (1) #5 Toast add-to-list ✓: top-right 'Lomo curado de cerdo Duroc adicionado a QA S238 teste' + check verde pós click 'Adicionar à lista' sheet modal. (2) #8 Logos SVG ✓: /supermarkets/lidl.svg HTTP 200 prod · SupermarketBadge serving <img alt=LIDL src=/supermarkets/lidl.svg> · placeholder ADR 0043 brand-colored com iniciais ('LI' círculo amarelo) até drop-in logo oficial. (3) Zero regressão modal Adicionar + hybrid list + TOTAL POR SUPERMERCADO. Vercel rate-limit NÃO bloqueou prod deploy (main sync). — PR feat(web) bundle polish #5 toast + #8 logos mercados. #5 toast add-to-list via onSuccess callback (sonner fora next-intl Provider · caller tem t+scope) · useList cache read zero extra request · itemAddedToast i18n es+pt-BR com {product}+{list}. #8 SupermarketBadge component (img /supermarkets/<slug>.svg + onError fallback span bg=color preserva visual pré-S242) · 8 SVGs placeholder brand-colored ADR 0043 (LIDL azul#0050AA em amarelo#FFD100 contrast 5.4:1 AA) · 3 call sites replaced (price-comparison-grid + hybrid-basket-card + totals-by-market) · data-sentry-unmask logo chrome legítimo. 6/6 badge spec + add-modal spec + 1 toast test · 124/124 sweep · G0 s242 archive · Vercel rate-limit infra non-blocker.

**S241 #223 ✅ MERGED · Gate 3 APROVADO · Gate 4 APROVADO empírico prod (deploy b48c0f0 LIVE Render 22:38Z)** — PR fix(api) #6 badge DESACTUALIZADO retry policy (Fase 1+2). Shipped: (1) audit-stale-prices.mjs read-only ✓ (2) Retry SCHEDULED_CRON_RETRY_ATTEMPTS=3 + backoff 5min · removeOnComplete:50 preserved ✓ (3) Bootstrap sync pós-deploy OK: mercadona 4669 raw · lidl 1185 raw · dia/aldi enqueued · RETIRED carrefour+alcampo cleanup. **Baseline stale prod sample 50 produtos**: Eroski 100% stale 4/4 🔴 BUG REAL · Alcampo 100% 3/3 EXPECTED retired S213 · lidl 0% 19/19 · Mercadona 0% 20/20 · dia 0% 4/4 · total 14% stale. Zero regressão APIs 200. **Follow-up: Eroski 100% stale → inclui no S243 Fase 3 (OR S244 novo bundle sync fix Eroski)**. — PR fix(api) #6 badge DESACTUALIZADO retry policy (Fase 1+2). Fase 1 audit script scripts/audit-stale-prices.mjs read-only (zero writes/HTTP externo · lê Product/ProductPrice/Supermarket/SyncRun). Fase 2 SCHEDULED_CRON_JOB_OPTIONS attempts=3 + exp backoff 5min base (5/10/20=35min total) spread aditivo em queue.add · removeOnComplete/Fail 50 preservados · Mercadona ciclo 24h >> 35min janela retry OK. Spec 8/8 novos cobrem attempts+backoff type/delay+removeOn preservação. Sweep 224/224. RETIRED_SLUGS cleanup intacto. Zero schema. **Fase 3 (fix adapter específico) DEFER S242 após Boss rodar audit prod**.

**S240 #222 ✅ MERGED · Gate 3 APROVADO · Gate 4 ✅ APROVADO cold target 5-15s (9877ms medido · Boss corrige diagnóstico 2026-11-27 23:xx)** — PR fix(api) OCR singleton. Evidência Render logs: 'Tesseract worker terminated on module destroy' 22:39:42.74 bhh5b = exato momento deploy S241 LIVE (22:39:42.77 · instance nova bpj7b 22:39:41) · **ROLLOVER DEPLOY durante teste** · NÃO bug singleton/scaling. Upload #3 (5005ms) = cold instance nova. **Warm reuse ainda NÃO medido**. QA refaz warm check SEM deploy em andamento: 2 uploads <2min · mesma instance + 'singleton initialized' só 1x · target OCR warm ≤3s. — PR fix(api) OCR Mercadona latency. OcrService singleton canonical: promise cache + boot-fail recovery (workerPromise=null on catch) + OnModuleDestroy idempotente · resize guard meta.width && > 2000 · timings exposed (preprocess/ocr/init/total/resized) · processor delegado clean · Sentry+logging preservados · module register OcrService provider · 10/10 spec mocks tesseract+sharp cobre boot-fail retry + metadata undefined + empty text + destroy idempotent · zero schema · receipts suite 27/27 · Vercel rate-limit infra non-blocker (same #221 pattern).

**S239 fechado completo**: Evidência gate 4 QA: (1) Multi-select persistente: 3 produtos via CompareAddSheet · URL ?products=id1,id2,id3 · nav /minha-lista (badge persistiu) → volta /comparar SEM query → Zustand restaurou 3 produtos. (2) BottomNav badge 'Comparar (N)' desktop + numeric '3' mobile icon. (3) Badge '3/4' canto (COMPARE_MAX=4). (4) Botão trash 'Limpar seleção' → empty + badge zerado. (5) Mobile 390px Preços/Tabela stack cards · 'Mais barato primeiro' · zero overflow. (6) Zero regressão /minha-lista /produto · 'Já adicionado' disabled state funciona sheet.

**S239 #221 ✅ MERGED 22:16:31Z · Gate 3 APROVADO · Gate 4 APROVADO empírico cesta-web.vercel.app prod 22:30Z (Vercel rate-limit NÃO bloqueou prod deploy)** — PR fix(web) /comparar multi-select persistido + tabela mobile (#12+#13). API+Web CI SUCCESS · Vercel preview FAILURE infra (não required check main · não bloqueou merge). Entregas: Zustand compare.store · persist cesta-compare-v1 · reconcile URL-vs-store didReconcileRef · CompareMatrix mobile stack + table desktop + gradient hint · badge BottomNav SSR-safe · i18n compareBadge ICU plural + clearSelection es+pt-BR · 124/124 tests pass · G0 archive s239 · identidade-visual tokens preservados.

**S238 #220 ✅ MERGED · Gate 3 APROVADO · Gate 4 APROVADO empírico UI prod cesta-web.vercel.app 22:17Z** — PR fix(web) busca dentro lista #3+#4. Fluxo: register qa-s238-<ts>@cesta.test · /minha-lista · criar lista · abrir modal Adicionar. (1) #3 fotos: cada li tem img element (ProductImage) + fallback 'Sem foto' ImageOff icon · zero div cinza vazia. (2) #4 tap card: click 'button Ver detalhe' navegou /produto/cmwy6d03m02dbe49dkw0ir9b0. (3) #4 Add isolado: click 'button Adicionar à lista' sibling URL stable · ação separada. Zero regressão. — PR fix(web) /comparar multi-select persistido + tabela mobile (#12+#13). **Vercel preview FAILURE = rate-limit 24h infra (não código)** · Vercel NÃO é required status check em main (API+Web são). Reviewer confirmou não bloqueia merge. Entregas: Zustand compare.store NEW (espelha auth.store · persist cesta-compare-v1 · isHydrated + onRehydrateStorage) · reconcile URL-vs-store via didReconcileRef (1x pós-hidratação · URL deep-link vence · senão router.replace hidrata URL) · CompareMatrix mobile stack (sm:hidden) + table desktop (hidden sm:block) + gradient hint (lg:hidden) · badge BottomNav SSR-safe · i18n compareBadge ICU plural + clearSelection es+pt-BR · 124/124 tests pass · G0 archive s239 · identidade-visual tokens preservados (supermarketColor via style bg = brand color dinâmico DB · legítimo).

**S238 #220 Gate 3 APROVADO · auto-merge --squash + delete-branch armed · CI running** — PR fix(web) busca dentro lista #3+#4. Frontend-only clean: ProductImage fallback resolve #3 (imagem/placeholder visível) + sibling button resolve #4 sem stopPropagation (card click abre /produto/[id] · botão adicionar isolado). 5 specs vitest cobrem img+fallback+main-click+add-isolated+open-false. i18n es+pt-BR openDetail key. Zero backend/schema. G0 archive s238. Identidade-visual tokens preservados (cesta-green/border/surface/ink).

**S237 #219 ✅ MERGED · Gate 3 APROVADO · Gate 4 APROVADO 2 nits P3** — PR fix(api,web): ranking busca phrase > tokens > preço. Phrase match fix CORE OK: 'leche entera' 1º='Leche entera Gremlins Dia Láctea 3x200ml' · 2º='Leche entera brik 1L' · chocolate SUMIU top 5. 'coca cola zero' 1º='Coca-Cola zero 330ml' (2L pos 8 · size ASC 330→500→1,25L→2L · scope phrase>tokens>preço · NÃO exact-size). Enter home /?q=<term> (não /busca?q=<term> · 'não detalhe direto' ATINGIDO · URL difere spec Manager). Zero regressão /products /supermarkets /health 200. **Nits P3 S23X backlog**: (a) exact-size boost priorizar tamanho buscado na query · (b) rota literal /busca vs /?q= decisão product. — PR fix(api,web): ranking busca phrase > tokens > preço. QA baseline pré-fix confirmou bugs reais: 'leche entera' → 'Chocolate con leche almendras Nestlé' (WRONG) · 'coca cola zero' → 'Coca-Cola zero 1,25 L' (não 2L exact). Reviewer nota: Enter aponta /?q=<term> (home-client.tsx tela resultados via searchParams.get('q') · rota correta per repo arch · NÃO /busca). Spec regression 15 util + 7 service cobrem leche entera + coca cola zero + oreo + diacritics + hyphen + tier priority. Zero schema change. G0 archive s237.

**S236 #218 ✅ MERGED (HEAD · 21:23:46Z) · Gate 3 APROVADO · Gate 4 APROVADO pós-deploy 21:25Z** — PR fix(ops) keep-alive workflow fail soft + throttl. Evidência QA: workflow_dispatch run 46070194696 success 21:25:17Z (log 'Pinging URL + HTTP 200 + Response' · fail-soft code path presente) · /health prod HTTP 200 0.250s hot · gaps 6-9h continuam (fix cosmético fail-soft + log · NÃO elimina cold start funcional · precisa UptimeRobot externo pra real). Zero regressão outros flows. **Follow-up P2 S23X**: UptimeRobot externo (ou cron-job.org · Upstash QStash) pra eliminar cold start real (não cosmético). — PR fix(ops) keep-alive workflow fail soft + throttl. QA pré-gate 4 baseline: /health 200 hot 0.247s · workflow gaps 6-9h confirmados últimas 15 runs. Sprint NÃO elimina cold start · fail soft cosmético documentado. Reviewer armou --squash + delete-branch 21:22:27Z. Gate 4 QA pós-deploy documenta workflow + /health + gaps continuam.
**S236 P1 #1 Render keep-alive workflow (Boss protocol bug>polish · chain matching em paralelo pendente Boss diagnostics)**.

**Contexto**: #217 S234+S235 ✅ merged · gate 3+4 ok. --apply chain BLOQUEADO Boss (aguarda Boss executar 4 scripts prod + review métrica). Dev avança P1 bugs independente em paralelo.

**#1 Render free spin-down 30s** · prod free tier spin-down após 15min idle · primeira request pós-idle leva ~30s cold start. User reclama lentidão intermitente.

**Fix**:
- GitHub Actions workflow  cron */10 * * * * (a cada 10min < spin-down 15min threshold).
- Curl GET /health endpoint https://cesta-gsvc.onrender.com/health.
- Fail soft (log only · não quebra CI).
- Opcionalmente + notification Slack/email se health 5xx > 3 vezes seguidas (defer).

**Procedimento**:
1. Criar workflow YAML.
2. Spec lint (yamllint OR actionlint).
3. Deploy + monitor 1h GitHub Actions runs.
4. Validar Render dashboard cold start eliminado (uptime continuous).

**Guardas**:
- Workflow NÃO polling de aplicação (event-driven impossible pro keep-alive · exception documentada ADR 0043 se precisar).
- Fail soft · zero dependency outra queue/bg.
- G0 archive pointers.

**Branch**: fix/s236-render-keepalive-workflow.
**PR SEM --auto**. Reviewer arma gate 3 APROVADO.

**Chain pendente paralelo**:
- Boss executa diagnose-match-test-set + audit-national-brand-ceiling + cleanup-seed-prices dry-run + match-cluster rerun prod.
- Boss decide --apply condicionais pós métrica.

**P1 backlog próximas sprints**:
- #14 OCR Mercadona lento.
- #6 badge DESACTUALIZADO sync falhando.
- #2 ranking frase/categoria antes preço (absorveu nit S228 #207).
- #3/#4 busca dentro lista.
- #12/#13 /comparar multi-select + tabela mobile.

**P2**:
- #5 toast · #8 logos.

## Fechamentos recentes (append conforme gates)

**S236 #218 Gate 3 APROVADO · auto-merge --squash + delete-branch armed 21:22:27Z · CI running** — PR fix(ops) keep-alive workflow fail soft + throttl. QA pré-gate 4 baseline: /health HTTP 200 0.247s hot · workflow gaps 6-9h confirmados últimas 15 runs (GitHub Actions cron free tier não garante schedule · Dev reconheceu PR body). Sprint funcional NÃO elimina cold start · só fail soft cosmético. Gate 4 QA pós-merge documenta: workflow run OK + /health 200 pós-deploy + gaps continuam.
**S235 DIAGNOSTIC + VARIANTE + MARCA PRÓPRIA (Boss 2026-11-27 pós-S234 · --apply VETADO)**.

**Boss diagnostic S234 #216**: NÃO aplica. 18 dupl em 10982 = 0.16% · recall ainda ~0. Nenhum do test set casou em prod (Coca-Cola Zero 2L / Original 2L / lata 330ml / Milka 125g / leche 1L). Erro 11% > 5% threshold. Spec 25/25 passa em fixture · prod diverge.

**Insight Boss**: Mercadona quase todo marca própria (Hacendado) · por definição NÃO existe em outro mercado. Comparação idêntica só vale pra marcas nacionais.

**S235 scope (3 diagnostics + 1 proposta)**:

**(1) TRACE em prod do test set**: pra cada item test (Coca-Cola Zero 2L etc), mostrar produtos de cada mercado + em QUAL gate par morre (brand · size · jaccard) com valores concretos. Output: tabela trace por produto · gate failure por par.

**(2) TETO real**: quantos produtos marca nacional (NÃO marca própria) existem em ≥2 mercados por marca+tamanho. Recall max possível. Query prod read-only · agrupa brand+size · count distinct supermarket. Marca própria = Hacendado/Dia/Milsani/Alcampo/ElCorteIngles/etc · filtra out.

**(3) VARIANTE/SABOR**: tokens variante OBRIGATÓRIOS iguais (Oreo golden ≠ Oreo original · Lays Horno ≠ Lays jamón). Extend S234 name normalize · variante tokens dicionário · gate strict.

**(4) PROPOSTA (sem implementar · Boss leva user)**: 'produto equivalente' = mesma categoria+tipo+tamanho entre marcas próprias (Leche entera 1L Hacendado × Dia Lactea × Milsani). UI separa 'mesmo produto' (marca nacional idêntica) de 'equivalente' (marca própria mesma categoria).

**Branch**: feat/s235-g3-diagnostic-variante.

**PR SEM --auto**. G0 archive pointers.

**#216 S234**: OPEN · Dev decide folding into S235 OR separate merge (helpers brand dict + size pk + name normalize + seed cleanup podem ser foundation útil).

**--apply CHAIN BLOQUEADO** até recall >> 18 clusters (Boss explicit · ≤5% erro + cobre test set).

## Fechamentos recentes (append conforme gates)

**S234+S235 #217 ✅ MERGED 029901f (21:10:51Z) · Gate 3 APROVADO · Gate 4 APROVADO deploy empírico** — PR folded S234+S235 (super-PR). Gate 4 QA: migration ProductPrice.deletedAt aplicada clean (uptime 36s) · 6/6 APIs 200 · zero regressão. Spec local brand-normalize 31/31 ✅ (variant gate Oreo/Coca/Milka/Lays + sizeMatch 2L!=1.5L + parseSize + extractBrand + normalizeNameForMatch). **Pendente Boss executar prod**: (1) diagnose-match-test-set.mjs trace · (2) audit-national-brand-ceiling.mjs teto · (3) cleanup-seed-prices.mjs flag seed Hacendado cross-market · (4) match-cluster.mjs --limit=10982 rerun · (5) QA revisa sample 30 pós dry-run. ADRs 0041 Aceito + 0042 Proposed (Equivalente) docs-only.

**S234+S235 #217 ✅ MERGED 029901f · Gate 3 APROVADO (fast-forward squash delete · 3753+/166- · 15 files)** — PR folded diagnostics + variante + marca própria proposta. Entregas:
- Migration ADITIVA deleted_at ProductPrice + CREATE INDEX (soft-delete reversível).
- schema.prisma soft-delete field + repo filter deletedAt:null em queries (findMany/findForSearch/findSuggestions).
- ADR 0041 Aceito: brand dict + size expand + seed soft-delete.
- ADR 0042 PROPOSED: produto equivalente marcas próprias (Boss leva user · UI separa 'mesmo produto' vs 'equivalente').
- Scripts: diagnose-match-test-set.mjs · audit-national-brand-ceiling.mjs · cleanup-seed-prices.mjs.
- match-cluster.mjs expand 7-stage pipeline: SQL array_agg DISJUNTOS + brand_eff dict + sizeMatch expanded + token Jaccard + union-find + eleição + apply.
- brand-normalize lib + spec standalone node runnable (extractBrand + parseSize + sizeMatch + normalizeNameForMatch + extractVariants + variantMatch).
- VARIANT_TOKENS Zero/Original/Light/Golden/Horno set-igual strict.
- G0 archive s234+s235 4 files.
- CI 4/4 ✅. Guards 1-9 ✅.

**--apply CHAIN AINDA BLOQUEADO Boss** até: (a) rerun match-cluster pós-S235 helpers · recall >> 18 clusters · (b) diagnose-match-test-set roda prod · test set casa · (c) sample 30 ≤5% erro.
**S234 FIX RECALL G3 cluster (Boss diagnostic 19:16Z · PRIORIDADE)** · --apply #214 PAUSADO até S234 land.

**Diagnóstico Boss (query prod read-only)**: 4 clusters em 10982 = recall ~0. Aplicar agora NÃO muda user experience. Aplica 1x só junto com fix recall.

**Causas identificadas**:
1. brand NULL em boa parte Mercadona (Hacendado) e Froiz (Milka) → gate 'marca igual' mata match.
2. Coca-Cola Zero existe em dia:16 · mercadona:2 · lidl:1 · NÃO casou.
3. **DADO FALSO (seed)**: 27 produtos seed têm preço em 7 mercados · ex 'Leche entera brik 1L Hacendado' em aldi/dia/alcampo/carrefour · Hacendado é marca própria Mercadona. **Seed cross-market é fake · polui análise**.

**S234 P0 fix (5 pontos vinculantes)**:
(a) **Extract brand** do nome quando brand null · dicionário marcas catálogo + próprias (Hacendado/Dia/Milsani etc).
(b) **Normalize name** removendo marca + tamanho + palavras genéricas (refresco · bebida) antes trigram.
(c) **parseSize expand** cobrindo '2 L', '2L', '1,25 L', '12 x 330 ml', 'pack 6 x 1 L'.
(d) **Spec test fixo**: Coca-Cola Zero 2L · Coca-Cola Original 2L · Coca-Cola Zero 330ml · Milka 125g · leche entera 1L · cada deve casar DIA × Mercadona (× LIDL quando existir).
(e) **Seed cleanup**: soft-delete (deleted_at) dos preços seed em mercados falsos (Hacendado em Aldi/Carrefour/Alcampo) OR seed inteiro · ADITIVO e REVERSÍVEL. Schema change: Product/ProductPrice ganha deleted_at nullable.

**Branch**: feat/s234-g3-recall-fix.

**Dry-run full no PR** com contagem clusters + amostra 30 QA · esperado recall >> 4 clusters.

**--apply pós S234 merge** vai precisar OK USER (classifier bloqueia UPDATE prod em auto mode) · Boss leva ao user quando dry-run estiver bom.

**Guardas Boss** (herdadas):
1. Migration ADITIVA (deleted_at nullable em Product/ProductPrice).
2. LIGA não apaga (soft-delete = flag · hard-delete proibido).
3. PITR S228 protocol.
4. Dry-run default idempotente.
5. ADR 0040 UPDATE S234 (OR 0041 novo) · rollback SQL.
6. Strict marca+size S231 preservado.
7. Amostra 30 QA · ≤5% erro.
8. G0 archive pointers.

**PR SEM --auto** · Reviewer arma gate 3 APROVADO.

**Chain pré-apply**:
1. S234 merge.
2. Dry-run full --limit=10982 cluster G3 · contagem + amostra 30.
3. QA review 30 · ≤5% erro.
4. Boss leva user · user OK destrava harness.
5. --apply match-cluster + mercadona-backfill #212 + canonical #209 sequence.
6. Métrica loop pós-apply.

## Fechamentos recentes (append conforme gates)
**S233 FOLLOW-UP remove match-trigram antigo (Boss regra replace in place 19:07Z)** · PR #213 S231 FECHADO (superseded by #214).

**Contexto**: Boss aplicou regra claude-geral-consolidado 'replace in place · zero v2 paralelo'. match-cluster.mjs (novo #214) ao lado de match-trigram.mjs (velho #211) viola. #213 S231 (patch do antigo) fechado como superseded.

**S233 escopo**:
1. rm scripts/match-trigram.mjs.
2. Remove/atualiza scripts/audit-trigram-match.mjs.
3. Grep remove refs match-trigram em docs/CI/package.json.
4. ADR 0039 marca EXPLÍCITO 'Superseded by 0040 · match-trigram removed S233'.
5. G0 archive pointers.
6. ProductMatchReview table FICA (match-cluster usa).

**Branch**: chore/s233-remove-match-trigram-legacy.
**Dependência**: aguarda #214 S232 MERGE primeiro.
**PR SEM --auto**.

**S232 #214** cluster-based G3 gate 3 APROVADO 19:05Z · auto-merge armed · CI Web pending (API+Vercel pass).

**--apply protocolos** (Boss 19:07Z confirmou já autorizados · Dev executa sem ping Manager):
- mercadona-backfill-ean.mjs --limit 30 dry-run → se >0 plausível · --apply lotes · timestamp UTC PR #212.
- match-cluster.mjs --limit=10982 dry-run full → sample 30 QA · se ≤5% · --apply lotes · timestamp UTC PR #214.
- Métrica loop pós cada --apply: % produtos >=2 mercados + spot Coca-Cola Zero 2L/lata 330ml/Milka/leite entera. Dev ping Boss COM MÉTRICA.

## Fechamentos recentes (append conforme gates)

**S233 #215 Gate 3 APROVADO · auto-merge --squash armed 19:15Z · CI running** — PR chore remove match-trigram legacy (Boss regra replace in place 19:07Z). Guards 1-8 ✅: rm scripts/match-trigram.mjs (239L) · audit-trigram-match.mjs header aponta match-cluster (preserva função) · zero ref código/config remanescente (grep só docs/archive histórico + match-cluster context) · ADR 0039 'Superseded by 0040 · removido em S233' explícito · G0 archive s233 2 files · 4 .md pass replace in place · ProductMatchReview table PRESERVADA (migration live fila futura) · zero schema/runtime change. Scope limpo.

**S232 #214 ✅ MERGED (ADR 0040 cluster-based G3)** · fix Boss design flaw 19:00Z. --apply protocolos Boss já autorizou 19:07Z (Dev executa sem ping). Métrica loop próximo evento.
**--APPLY WAVE EM CURSO + S232 CLUSTER-BASED PR #214 OPEN** (Boss 2026-11-27 19:00Z design fix).

**S232 PR #214** cluster-based G3 (supersede ADR 0039). Algoritmo:
- SQL brand + similarity >= 0.75 + cross-mercado EXISTS pre-filter.
- JS sizeMatch strict (reusa S231 parseSize).
- Union-find DSU forma clusters N-way.
- Eleição canonical: has_ean DESC + createdAt ASC + id ASC.
- updateMany idempotente canonicalProductId.

**Empirical dry-run prod --limit=500**: 66 pares -> 12 strict -> 2 clusters (Carbonell aceite 1L · Azucarera azúcar 1kg · sample visual aprovado · gate strict elimina ~80% falsos positivos).

Guards 1-8 cumpridas: ZERO schema change (reusa G2 FK + G3 review table) · LIGA não apaga · PITR reminder · dry-run default · ADR 0039 UPDATE + rollback · S231 strict marca+size · G0 archive snapshots s232.

**Dependência #213 S231** (parseSize/sizeMatch helpers · OPEN · CI running).

**Pendente Boss**: tirar snapshot Neon + rerun dry-run full --limit=10982 + sample 30 QA → se ≤5% erro --apply lotes.

**#213 S231** strict size+brand gate pré-apply trigram · OPEN · CI running.

**Ação paralela Dev pós #213/#214 merge** (Boss 19:00Z protocol): rodar mercadona-backfill-ean.mjs --limit 30 (dry-run) · se ean_found > 0 plausível · --apply lotes 100/500/full · timestamp UTC no PR #212.

## Fechamentos recentes (append conforme gates)

**S232 #214 Gate 3 APROVADO · auto-merge armed 19:05Z · CI Web pending · API 2m20s pass · Vercel pass** — PR cluster-based G3 (ADR 0040 supersede 0039 · fix Boss design flaw 19:00Z). Algoritmo cluster union-find DSU zero EAN pre-req. electCanonical has_ean DESC→createdAt ASC→id ASC. SQL c.id>d.id symmetric + EXISTS cross-market pre-filter. parseSize/sizeMatch inline standalone (não depende #213 merge). Guards 1-8 ✓. Empírico dry-run --limit=500: 66 pares → 12 strict → 2 clusters Carbonell/Azucarera visual OK. Nits P3 S233: parseSize duplicate intencional · CTE row duplication · comment doc inconsistency. **Pendente Boss**: snapshot Neon + rerun dry-run full --limit=10982 + sample 30 QA → ≤5% → --apply.

## S229 fechamentos (append conforme gates)
**S232 FIX DESENHO G3 cluster-based match (Boss 2026-11-27 19:00Z · prioridade > cron Aldi)**.

**FALHA DESENHO G3 descoberta**: match-trigram #211 exige canonicals de EAN (match duplicate ean=null vs canonical ean=X). Mas G3 existe JUSTAMENTE pra mercados SEM EAN. Pré-requisito EAN é bug de design.

**Fix S232**: G3 cluster-based:
- Comparar produtos ENTRE mercados diferentes diretamente (pares DIA × Mercadona × LIDL × Aldi × Eroski × Froiz).
- Formar cluster via similarity trigram + brand match + size match (strict S231).
- Eleger 1 canonical por cluster (heurística: menor id · OR mercado com mais produtos · OR primeiro inserido).
- SEM pré-requisito EAN.

**Guardas Boss (vinculantes · herdadas S228 G2 + S231)**:
1. Migration ADITIVA (reusa canonicalProductId FK + product_match_reviews table · nenhum schema change novo).
2. Cluster LIGA (UPDATE canonicalProductId N-way) · NÃO apaga.
3. PITR S228 protocol (dry-run + timestamp UTC antes --apply).
4. Dry-run default + --apply opt-in idempotente.
5. ADR 0039 UPDATE S232 (OR novo ADR 0040) cluster algoritmo + rollback SQL.
6. Strict marca + tamanho (S231 parseSize + sizeMatch).
7. Amostra 30 QA pré-apply · ≤5% erro.
8. G0 archive pointers (pendente + sprints).

**Branch**: feat/s232-g3-cluster-match-no-ean.

**PR SEM auto-merge** (regra Boss). Reviewer arma --auto no gate 3 APROVADO.

**Dependência**: paralelo a #213 S231 (strict gate). S232 pode usar S231 parseSize/sizeMatch helpers reutilizáveis.

**Ação paralela Dev pós #213 merge** (Boss 19:00Z protocol):
Your branch is up to date with 'origin/main'.
Already up to date.

> cesta-api@0.0.1 postinstall
> prisma generate

Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma

✔ Generated Prisma Client (v5.22.0) to .
ode_modules\@prisma\client in 538ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

Tip: Need your database queries to be 1000x faster? Accelerate offers you that and more: https://pris.ly/tip-2-accelerate


added 984 packages, and audited 985 packages in 46s

192 packages are looking for funding
  run `npm fund` for details

3 moderate severity vulnerabilities

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
========================================================================
Sprint 229 G1b + S230 fix — mercadona-backfill-ean
========================================================================
Mode: DRY-RUN (nada será gravado)
Limit: 30 produtos nesta run

Candidatos (ean=NULL): 30

--- Summary ---
candidates:         30
fetched detail:     3
ean found:          0
http fail:          3
no source url:      27 (legacy pré-S224 · aguarda próximo cron S224 populate)
no id in url:       0 (sourceImageUrl presente mas regex Mercadona imgix não bateu · investigar URL shape)

--- HTTP failures (sample) ---
  product cmwnp5u1g00054bnj4vz7m5is merc_id=65c2349950feb1958362e06217003b10 status=404
  product cmwnp5umv000e4bnjwlpfhz3d merc_id=d105eae1cdad8c7e60beda10566a5381 status=404
  product cmwnp5v2s000n4bnjgk7048wk merc_id=c60e6e09dc2037a291515d3b15af376c status=404

--dry-run: Nenhuma mudança gravada. Para aplicar: --apply
Se ean_found > 0 plausível · --apply lotes 100/500/full com timestamp UTC colado no PR #212. Boss NÃO roda em árvore alheia (Dev dono dir principal).

## S229 fechamentos (append conforme gates)
**--APPLY WAVE EM CURSO** (Boss 2026-11-27 18:46Z autorizou A→B→C). **Discovery 18:52Z: 0 canonicals em prod bloqueia --apply trigram.**

**Estado prod atual (Dev audit)**:
- Products: with_ean=0 · without_ean=10982 · canonicals=0.
- match-trigram dry-run --limit=500: candidatos=0 (sem canônicos não há contra quem bater).
- Sample 30 HIGH IMPOSSÍVEL pré-população EAN.

**Causa raiz**:
1. G1 Aldi (#206 merged) · cron Aldi 03:00 UTC não rodou ainda.
2. Mercadona list perdeu ean (G1b finding) · precisa --apply mercadona-backfill via detail endpoint.
3. Alcampo+Carrefour frozen Akamai (pós-MVP).

**Caminho destravar** (ordem imediata):
1. **Boss trigger mercadona-backfill-ean.mjs --apply** (S230 fix mergeado 18:49Z · script agora usa sourceImageUrl correto). Dry-run --limit 30 primeiro · se ean_found > 0 plausível · --apply lotes 100 → 500 → full.
2. OR aguardar cron Aldi 03:00 UTC amanhã (popula ~300 EAN).
3. Rerun audit-trigram-match.mjs → sample 30 HIGH real pra QA.
4. #213 strict size+brand merge ANTES --apply trigram.
5. --apply trigram só pós QA revisar 30 HIGH + erro ≤5%.
6. --apply canonical (#209) pós (B) com Aldi + Mercadona EAN.

**S231 PR #213 OPEN · CI running · BLOCKED** (BEHIND rebase rodado agora) — trava strict size+brand gate pré-apply trigram. parseSize (ml/g/pack normalize) + sizeMatch igualdade estrita + tier reclassify high_auto REQUIRE score>=HIGH AND brand_match AND size_match. Compila OK · surte efeito pós-população canonicals.

**Gates #213**: aguarda CI verde → Reviewer gate 3 (size+brand strict) → merge.

**G0 archive mandatory** em PRs novos.

## S229 fechamentos (append conforme gates)
**--APPLY WAVE AUTORIZADO Boss 2026-11-27 18:46Z** (3 --apply sequencial · PITR protocol · trava extra trigram).

**Ordem Boss**:
**(A) #211 trigram AGORA paralelo** · trava extra:
- Link automático (≥0.75) SÓ se tamanho/unidade normalizados IGUAIS (2L != 1.5L · 330ml != 500ml · pack 6 != unidade) E marca igual.
- QA revisa amostra 30 links HIGH do audit · reporta % errados.
- > 5% errados = NÃO aplica · sobe threshold.
- LOW (0.6-0.75) → product_match_reviews (fila) · nunca link direto.

**(B) #210 Mercadona** pós S230 merge · lotes 100 → 500 → full.

**(C) #209 canonical EAN** pós (B) (Aldi + Mercadona com EAN → match ≥ 2 mercados).

**Pós cada --apply**: medir % produtos ≥2 mercados + spot check Coca-Cola Zero 2L / lata 330ml / Milka / leite entera em prod. Ping Boss com métrica (não cada passo).

**S230 PR #212** (fix mercadona-backfill): gate 3 Reviewer + gate 4 QA em curso · CI running. Script bug fix 3 pontos (sourceImageUrl ID + HTTP diag + rollback).

**Protocolo PITR cada --apply**:
1. Operador cola dry-run contagem no PR.
2. Registra timestamp UTC date -u IMEDIATAMENTE antes --apply = restore point.
3. Rollback primário SQL ADR · secundário Neon Restore pro timestamp.

**G0 archive mandatory**: ponteiros notes via note edit (Reviewer REPROVA se faltar em PRs novos).

## S229 fechamentos (append conforme gates)
**S230 FIX mercadona-backfill-ean (Boss finding 2026-11-27 18:40Z)** — bloqueia --apply G1b.

**Bug**: Boss rodou dry-run --limit 30 em worktree própria. 27/30 'no mercadona id (sem image_url padrão)' · 3/30 HTTP fail · **ean found 0** · nada gravado.

**Root cause**: script deriva Mercadona ID via imageUrl prod-mercadona.imgix.net/images/<id>.jpg · mas imageUrl agora aponta R2 (S213 bandwidth mitigation + S216 backfill images) · não bate regex.

**Fix (3 pontos)**:
1. **ID source**: usar adapter sourceId/externalId/slug persistido · OR **sourceImageUrl ORIGINAL** (S224 ADR 0032 adicionou Product.sourceImageUrl pra preservar URL original pre-R2). Preferir sourceImageUrl (não requer schema change).
2. **HTTP failures**: investigar 3/30 fail · status code? rate-limit polite fetch? User-Agent?
3. **Rollback coluna**: script ADR 0038 cita rollback via 'source = mercadona-backfill' — coluna NÃO existe no schema Product. Fix rollback: usar updated_at timestamp registrado + Neon PITR como fallback (padrão S228 G2).

**Procedimento validação**:
- Rerun dry-run --limit 30 após fix · esperado ean found > 0.
- Se > 0 plausível · --apply lotes incrementais (--limit 100 → 500 → full).

**G0 archive mandatory**: ponteiros pendente + sprints notes via note edit (Reviewer REPROVA se faltar).

**Branch**: fix/s230-mercadona-backfill-id-source.

**PR SEM auto-merge** (regra Boss 14:10). Reviewer arma --auto no gate 3 APROVADO.

**Dependência**: Dev começa imediato · paralelo a #211 CI pending. Script standalone (não bloqueia G3 deploy).

## S229 fechamentos (append conforme gates)
**S229 MATCHING PART 2 (paralelo G1b + G3)** — Boss 2026-11-27 pós-S228 wave.

**Contexto:** G1 S228 só populou EAN do Aldi · G2 merge por EAN precisa ≥2 mercados com EAN → hoje linka ~0. Plano Boss: G1b e G3 em paralelo (vários mercados podem não expor EAN).

**G1b EAN audit + populate (outros adapters)**:
- Audit por adapter (Mercadona API · DIA · LIDL · Eroski · Froiz) · identificar campo de origem (gtin, ean, código barras, product_id ISBN-like).
- Popular Product.ean onde fonte expõe.
- Documentar gap onde fonte não expõe (vai pra G3).
- Spec adapter ean-extraction por adapter.
- Gate 3 Reviewer: coverage pré/pós per-adapter audit script (reusa audit-ean-coverage.mjs de S228 G1).

**G3 match sem EAN (trigram)**:
- Chave normalizada: brand + normalized_name + size_unit (ex 'coca-cola zero azucar 2 l' == 'coca zero 2 l').
- pg_trgm similarity + confidence score + threshold.
- Match ≥ threshold → canonical link (reusa Product.canonicalProductId de S228 G2).
- Match abaixo threshold → fila revisão manual (tabela ou flag).
- Audit script: top 200 itens básicos (Coca-Cola Zero 2L · lata 330ml · Milka · leite) cross-market match %.

**Branches paralelas**:
- feat/s229-g1b-ean-audit-remaining-adapters
- feat/s229-g3-trigram-match-no-ean

**G0 archive mandatory**: ponteiros pendente + sprints notes via note edit (Reviewer REPROVA se faltar).

**Métrica Boss (loop metric):**
- % produtos em ≥2 mercados (baseline 0.4% · reteste QA sample 800/800 → 2 multi-market).
- Top itens básicos comparáveis (Coca-Cola Zero 2L · lata 330ml · Milka · leite).

**P1 deferido (pós G1b+G3+apply canonical):**
- #14 OCR Mercadona lento.
- #6 badge DESACTUALIZADO (corrigir sync falhando · qual mercado · por quê · NÃO esconder badge).
- #1 Render free spin-down 30s · keep-alive workflow.
- **#2 Enter/seta busca → tela resultados ordenada + ranking por match de frase/categoria ANTES de preço** (Boss 2026-11-27 · absorve nit S228 #207: 'leche entera' retorna 'Chocolate con leche almendras enteras' primeiro · exato tipo de regressão user nota no 1º uso · NÃO defer).
- #3/#4 busca dentro lista (sem fotos + toque produto abre detalhe).
- #12/#13 /comparar multi-select persistente + tabela mobile.

**P2 deferido:**
- #5 toast 'X adicionado à lista'.
- #8 logos mercados.

**PR SEM auto-merge** (regra Boss 2026-11-27). Reviewer arma --auto no gate 3 APROVADO.

## S229 fechamentos (append conforme gates)

**S230 #212 Gate 3 APROVADO · auto-merge --squash armed 18:48Z · CI running** — PR fix mercadona-backfill-ean (ADR 0038 Update S230). Guards 1-7 ✅ Reviewer: (a) extractMercadonaId strict sourceImageUrl ONLY zero fallback R2 · contadores noSourceUrl vs noIdInUrl separados · (b) fetchDetail captura status+retry-after+cf-ray+x-request-id + sample 10 falhas · (c) rollback nowUtc ISO printado no --apply + PITR primário + updated_at timestamp secundário zero ref coluna source. ADR 0038 Updates S230 seção completa + validação procedure. Nits P3 S231 backlog: ean @unique collision só logga (podia enqueue review) · jitter 2-4s random polite fetch.

**S229 #211 ✅ MERGED 18:41:04Z · Gate 3 APROVADO · Gate 4 APROVADO deploy** — PR G3 trigram match-no-ean (ADR 0039). Migration CREATE TABLE product_match_reviews aplicada clean Prisma deploy · Render restart sem erro (uptime 36s) · 5/5 endpoints 200 pós-deploy (products limit/search/supermarket + supermarkets + health) · zero regressão runtime (scripts standalone não importados por serviço). --apply pendente Boss PITR: audit-trigram-match.mjs + match-trigram.mjs. Nits P3 S230 backlog: GIN index normalized_name · cuid custom · rollback opção A destrutiva. — PR G3 trigram match-no-ean (ADR 0039). Guards 1-5 verificados Reviewer: migration ADITIVA CREATE TABLE product_match_reviews+FKs+UNIQUE+INDEX · UPDATE canonicalProductId+INSERT review zero DELETE · PITR S228 inherited · dry-run default +--apply opt-in filtro canonicalProductId IS NULL + UNIQUE(dup,canon) · ADR 0039 rollback SQL opções A/B/C + review DELETE + DROP TABLE. pg_trgm já enabled S180. Schema: Decimal(4,3) similarity + status pending/approved/rejected + CASCADE FKs. Thresholds HIGH 0.75/LOW 0.6/BRAND_BONUS 0.1 configuráveis. 4 .md pass. Nits P3 non-blocker S230: GIN index ausente normalized_name (S180 só cobre name/brand) · cuid() custom reimpl · rollback opção A destrutiva G2 (marcado destrutivo · PITR recomendada). — PR scope ADR 0039: schema aditivo nova table ProductMatchReview (duplicate+canonical+similarityScore+status pending/approved/rejected · UNIQUE pair · idx status+createdAt · FKs CASCADE) · migration 20261127190000_sprint229_product_match_review CREATE TABLE+CONSTRAINT+INDEX apenas · scripts/match-trigram.mjs dry-run default + --apply config HIGH 0.75/LOW 0.6/BRAND_BONUS 0.1/LIMIT 500 (CROSS JOIN LATERAL top-1 word_similarity + brand bonus · idempotente UPDATE Product.canonicalProductId + INSERT ProductMatchReview) · scripts/audit-trigram-match.mjs read-only 3 views (linked + review queue + top 29 itens básicos) · ADR 0039 algoritmo+thresholds+trade-offs+rollback SQL completo. Zero DROP · zero runtime change. Dependência G2 #209 ✅ (FK) · G1b #210 ✅ (paralelo). Gate 3 + 4 enfileirados.

**S230 #212 ✅ MERGED 18:49:49Z · Gate 3 APROVADO · Gate 4 N/A (script-only)** — PR fix mercadona-backfill-ean (ADR 0038 Update S230). Guards 1-7 ✅ · nits P3 S231 backlog. Script agora usa sourceImageUrl strict (não cai em imageUrl R2).

**S229 #210 ✅ MERGED 18:34:25Z · Gate 3 APROVADO · Gate 4 APROVADO code+deploy** — PR G1b EAN audit 5 adapters + Mercadona backfill (ADR 0038). QA pós-merge sanity prod 6/6 endpoints 200 (zero regressão). --apply mercadona-backfill pendente Boss (script dry-run default + --apply --limit N opt-in). Key finding Mercadona list dropped ean upstream · detail ainda expõe. 4 adapters (DIA/LIDL/Eroski/Froiz) GAP cobertos por G3 #211. — PR G1b EAN audit 5 adapters + Mercadona backfill (ADR 0038). Key finding: Mercadona /api/categories/<id>/ PERDEU campo ean em prod (993 sampleados · 0 ean · regressão upstream Mercadona) · detail /api/products/<id>/ ainda retorna. DIA/LIDL/Eroski probe 403 anti-bot bloqueado (Reviewer limitação IP igual Dev · Boss executa prod se decidir). Froiz probe OK zero EAN. 4 adapters (DIA/LIDL/Eroski/Froiz) GAP → G3 trigram cobre paralelo. Scripts: audit-adapter-ean-sources.mjs read-only probe + mercadona-backfill-ean.mjs (extrai ID via imageUrl prod-mercadona.imgix.net · dry-run default + --apply --limit N opt-in · UPDATE ean idempotente ean IS NULL). ADR 0038 audit + rollback SQL completo + PITR S228 inherited. G0 archive docs/archive/{pendente,sprints}-note-2026-11-27-s229.md + ponteiros note edit. Zero adapter runtime change · zero migration. Nits P3 S230: Mercadona ID via imageUrl frágil + rollback via updated_at timestamp.

**ALERTA regra Loop (Boss 2026-11-27 18:30Z)**: Dev abriu #210 COM auto-merge armado pré-gate 3 (viola regra 14:10 'Dev abre SEM auto-merge · Reviewer arma'). Boss desarmou · Reviewer re-armou pós aprovar. Dev reforçado próximas PRs.

## S228 fechamentos (append conforme gates)
**S228 RETESTE OFICIAL USER (17 itens)** — Boss 2026-11-27 17:30 · FIM PAUSA · heartbeat religado.

**G0 MANDATORY cada sprint S228+**: arquiva nota 'Cesta — Pendente' (~48KB) + 'Cesta — Sprints' (~40KB) em docs/archive/ (`pendente-note-2026-11-27.md` + `sprints-note-2026-11-27-b.md`) + ponteiros via note edit. Reviewer REPROVA se faltar.

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
- **#17 Boss correção 17:xx**: alerta DEFAULT /alertas/novo (primeiro/mais visível) = **1 produto** (preço abaixo X OR queda %). Combo = opção SECUNDÁRIA. Corrigir mensagem 'Mínimo 2' + placeholder 10.00. #16 retesta pós-fix double-fire #15.
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

**Branch S228 #15**: `fix/s228-15-token-ausente-nota-fiscal`.

## Status dev
S243 #225 PR aberto (5230e75) SEM --auto · fix/s243-ocr-graceful-shutdown-token-refresh · gate 3+4 solicitados. 2 bugs correlatos pós-S240 Render deploy. (1) OCR shutdown: OcrService flag destroyed no topo do onModuleDestroy bloqueia novas chamadas sem corrida com terminate; checagem em 3 pontos de extractTextFromImage (entrada+pós-preprocess+pós-boot) corta entre awaits se destroy chega no meio; OcrServiceDestroyedError propagado faz BullMQ retry na próxima instance. (2) Upload refresh: useUploadReceipt onError detecta ApiError 401 (post refresh fail) → clearAuth + toast common.sessionExpired + router.push /login?returnUrl=%2Fgastos. i18n es+pt-BR nova key common.sessionExpired. Specs: ocr.service 14/14 (+4 S243) · use-expenses 4/4 (+2 S243). Typecheck clean. G0 archive s243 + ponteiros. Paralelo S242 #224 QA Vercel rate-limit delay. Fila Boss S244: Eroski 100% stale (QA achou em S241).

## S228 fechamentos (append conforme gates)

**S228 #207 ✅ MERGED 18:23:13Z · Gate 4 APROVADO empírico prod** — PR #7 busca multi-palavra tokenize AND-of-OR. buildMultiTokenNameBrandWhere(q) produz AND-of-OR por token (cada token match name OU brand). 8 queries validadas prod: coca zero → 19 (antes 0) · coca cola zero → 19 (antes 0) · leche entera → 40 · pan integral → 30 · chocolate milka → 14 · agua mineral → 74 · queso oveja → 22 · aceite oliva → 126 · yogur griego → 27. Nit absorvido pelo P1 #2 (ranking frase/categoria antes de preço · Boss 2026-11-27 · NÃO defer).

**S228 #209 --dry-run prod rodado 2026-11-27T18:28:02Z UTC** · candidatos=0 esperado (só Aldi tem EAN · merge precisa ≥2 mercados com EAN). PR #209 comment registrado. --apply fica parado até S229 G1b popular EAN em Mercadona/DIA/LIDL/Eroski/Froiz.

**S228 #209 ✅ MERGED (G2 canonical merge · HEAD aa5bca0) · Gate 3 APROVADO (ADR 0037 · Boss PITR protocol satisfaz guard 3)** — PR scope CRÍTICO (prod data): migration ADITIVA Product.canonicalProductId self-FK nullable+index (ZERO DROP) · linkSupermarketDuplicate SÓ UPDATE (preserva FKs favorites/lists/alerts/reviews) · SyncResult.itemsMergedCanonical observability · scripts/merge-canonicals.mjs dry-run default + --apply idempotente batch 500 · scripts/audit-canonical-merge.mjs read-only 3 views · ADR 0037 Boss guards + rollback SQL completo. Jest 213/213 +5 novos. CI 4/4 ✅. PITR protocol: operador do --apply cola contagem dry-run + timestamp UTC date -u IMEDIATAMENTE antes --apply (restore point Neon Launch). Rollback primário SQL ADR 0037 · secundário Neon Restore. **Pendências pós-merge**: deploy prod Render autoDeploy main · operador roda --dry-run + --apply em prod (Boss decide quando) · gate 4 QA audit-canonical-merge single→multi market growth.

**S228 #206 ✅ MERGED 18:08:07Z · Gate 3 APROVADO (code only + ADR 0036)** — PR G1 EAN audit + Aldi JSON-LD gtin extraction. Scope: aldi.adapter gtin13→12→gtin→gtin8 fallback + asString helper + ProductDb.ean propagado · audit-ean-coverage.mjs 3 views · ADR 0036 documenta gaps DIA/Eroski/Froiz/LIDL (G3 trigram). CI 4/4 ✅. Jest +135 (4 specs novos). Gate 4 empírico PENDENTE: Render autoDeploy + manual-sync aldi OR cron daily 07:00 CET amanhã · sample Aldi EAN coverage esperado > 0% (baseline pre-fix 0/300).

**S228 #15b + #16 ✅ MERGED 18:02:51Z (HEAD 7672cfc) · Gate 4 APROVADO prod empírico** — PR #208 fix web uploadReceipt Content-Type override per-request + inflightRef ref-guard. Root cause compartilhado #15+#16: axios instance default 'Content-Type: application/json' forçava FormData→JSON → multer rejeitava → ticket nunca persistia. QA prod iPhone Safari-like 390px: 1 POST xhr 202 + redirect /gastos/<receiptId> + toast OCR + supermercado detectado + total 225 cents parseado. #16 GET /receipts/<id> 200 status='ready' errorMessage=null (resolvido junto). Double-fire bloqueado (ref-guard). Nit S229 non-blocker: #17 Combo stale msg 'Mínimo 2' persiste com 2 selecionados.

## Histórico (S170+)
Snapshots: S170-S204 → `docs/archive/sprints-note-2026-11-26.md`. S205-S224 → `docs/archive/sprints-note-2026-11-27.md`. S225-S227 + raw-old → `docs/archive/sprints-note-2026-11-27-b.md`. Entries abaixo são S228+ (append aqui conforme fechamento).
