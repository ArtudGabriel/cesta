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
- Protocolo de bastão: nota `Cesta — Loop`.

---

## Sprint ativa
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
S228 #15 em curso: expenses.service uploadReceipt — remover Content-Type explícito + per-request `adapter: 'xhr'` pra passar Authorization confiavelmente + manter onUploadProgress nativo. G0 archive pendente+sprints incluído no PR.

## S228 fechamentos (append conforme gates)

**S228 #207 ✅ MERGED 18:23:13Z · Gate 4 APROVADO empírico prod** — PR #7 busca multi-palavra tokenize AND-of-OR. buildMultiTokenNameBrandWhere(q) produz AND-of-OR por token (cada token match name OU brand). 8 queries validadas prod: coca zero → 19 (antes 0) · coca cola zero → 19 (antes 0) · leche entera → 40 · pan integral → 30 · chocolate milka → 14 · agua mineral → 74 · queso oveja → 22 · aceite oliva → 126 · yogur griego → 27. Nit absorvido pelo P1 #2 (ranking frase/categoria antes de preço · Boss 2026-11-27 · NÃO defer).

**S228 #209 --dry-run prod rodado 2026-11-27T18:28:02Z UTC** · candidatos=0 esperado (só Aldi tem EAN · merge precisa ≥2 mercados com EAN). PR #209 comment registrado. --apply fica parado até S229 G1b popular EAN em Mercadona/DIA/LIDL/Eroski/Froiz.

**S228 #209 ✅ MERGED (G2 canonical merge · HEAD aa5bca0) · Gate 3 APROVADO (ADR 0037 · Boss PITR protocol satisfaz guard 3)** — PR scope CRÍTICO (prod data): migration ADITIVA Product.canonicalProductId self-FK nullable+index (ZERO DROP) · linkSupermarketDuplicate SÓ UPDATE (preserva FKs favorites/lists/alerts/reviews) · SyncResult.itemsMergedCanonical observability · scripts/merge-canonicals.mjs dry-run default + --apply idempotente batch 500 · scripts/audit-canonical-merge.mjs read-only 3 views · ADR 0037 Boss guards + rollback SQL completo. Jest 213/213 +5 novos. CI 4/4 ✅. PITR protocol: operador do --apply cola contagem dry-run + timestamp UTC date -u IMEDIATAMENTE antes --apply (restore point Neon Launch). Rollback primário SQL ADR 0037 · secundário Neon Restore. **Pendências pós-merge**: deploy prod Render autoDeploy main · operador roda --dry-run + --apply em prod (Boss decide quando) · gate 4 QA audit-canonical-merge single→multi market growth.

**S228 #206 ✅ MERGED 18:08:07Z · Gate 3 APROVADO (code only + ADR 0036)** — PR G1 EAN audit + Aldi JSON-LD gtin extraction. Scope: aldi.adapter gtin13→12→gtin→gtin8 fallback + asString helper + ProductDb.ean propagado · audit-ean-coverage.mjs 3 views · ADR 0036 documenta gaps DIA/Eroski/Froiz/LIDL (G3 trigram). CI 4/4 ✅. Jest +135 (4 specs novos). Gate 4 empírico PENDENTE: Render autoDeploy + manual-sync aldi OR cron daily 07:00 CET amanhã · sample Aldi EAN coverage esperado > 0% (baseline pre-fix 0/300).

**S228 #15b + #16 ✅ MERGED 18:02:51Z (HEAD 7672cfc) · Gate 4 APROVADO prod empírico** — PR #208 fix web uploadReceipt Content-Type override per-request + inflightRef ref-guard. Root cause compartilhado #15+#16: axios instance default 'Content-Type: application/json' forçava FormData→JSON → multer rejeitava → ticket nunca persistia. QA prod iPhone Safari-like 390px: 1 POST xhr 202 + redirect /gastos/<receiptId> + toast OCR + supermercado detectado + total 225 cents parseado. #16 GET /receipts/<id> 200 status='ready' errorMessage=null (resolvido junto). Double-fire bloqueado (ref-guard). Nit S229 non-blocker: #17 Combo stale msg 'Mínimo 2' persiste com 2 selecionados.

## Histórico (S170+)
Snapshots: S170-S204 → `docs/archive/sprints-note-2026-11-26.md`. S205-S224 → `docs/archive/sprints-note-2026-11-27.md`. S225-S227 + raw-old → `docs/archive/sprints-note-2026-11-27-b.md`. Entries abaixo são S228+ (append aqui conforme fechamento).
