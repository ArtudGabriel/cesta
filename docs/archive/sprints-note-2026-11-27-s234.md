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
- Protocolo de bastão: nota `Cesta — Loop`.

---

## Sprint ativa
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
S228 #15 em curso: expenses.service uploadReceipt — remover Content-Type explícito + per-request `adapter: 'xhr'` pra passar Authorization confiavelmente + manter onUploadProgress nativo. G0 archive pendente+sprints incluído no PR.

## S228 fechamentos (append conforme gates)

**S228 #207 ✅ MERGED 18:23:13Z · Gate 4 APROVADO empírico prod** — PR #7 busca multi-palavra tokenize AND-of-OR. buildMultiTokenNameBrandWhere(q) produz AND-of-OR por token (cada token match name OU brand). 8 queries validadas prod: coca zero → 19 (antes 0) · coca cola zero → 19 (antes 0) · leche entera → 40 · pan integral → 30 · chocolate milka → 14 · agua mineral → 74 · queso oveja → 22 · aceite oliva → 126 · yogur griego → 27. Nit absorvido pelo P1 #2 (ranking frase/categoria antes de preço · Boss 2026-11-27 · NÃO defer).

**S228 #209 --dry-run prod rodado 2026-11-27T18:28:02Z UTC** · candidatos=0 esperado (só Aldi tem EAN · merge precisa ≥2 mercados com EAN). PR #209 comment registrado. --apply fica parado até S229 G1b popular EAN em Mercadona/DIA/LIDL/Eroski/Froiz.

**S228 #209 ✅ MERGED (G2 canonical merge · HEAD aa5bca0) · Gate 3 APROVADO (ADR 0037 · Boss PITR protocol satisfaz guard 3)** — PR scope CRÍTICO (prod data): migration ADITIVA Product.canonicalProductId self-FK nullable+index (ZERO DROP) · linkSupermarketDuplicate SÓ UPDATE (preserva FKs favorites/lists/alerts/reviews) · SyncResult.itemsMergedCanonical observability · scripts/merge-canonicals.mjs dry-run default + --apply idempotente batch 500 · scripts/audit-canonical-merge.mjs read-only 3 views · ADR 0037 Boss guards + rollback SQL completo. Jest 213/213 +5 novos. CI 4/4 ✅. PITR protocol: operador do --apply cola contagem dry-run + timestamp UTC date -u IMEDIATAMENTE antes --apply (restore point Neon Launch). Rollback primário SQL ADR 0037 · secundário Neon Restore. **Pendências pós-merge**: deploy prod Render autoDeploy main · operador roda --dry-run + --apply em prod (Boss decide quando) · gate 4 QA audit-canonical-merge single→multi market growth.

**S228 #206 ✅ MERGED 18:08:07Z · Gate 3 APROVADO (code only + ADR 0036)** — PR G1 EAN audit + Aldi JSON-LD gtin extraction. Scope: aldi.adapter gtin13→12→gtin→gtin8 fallback + asString helper + ProductDb.ean propagado · audit-ean-coverage.mjs 3 views · ADR 0036 documenta gaps DIA/Eroski/Froiz/LIDL (G3 trigram). CI 4/4 ✅. Jest +135 (4 specs novos). Gate 4 empírico PENDENTE: Render autoDeploy + manual-sync aldi OR cron daily 07:00 CET amanhã · sample Aldi EAN coverage esperado > 0% (baseline pre-fix 0/300).

**S228 #15b + #16 ✅ MERGED 18:02:51Z (HEAD 7672cfc) · Gate 4 APROVADO prod empírico** — PR #208 fix web uploadReceipt Content-Type override per-request + inflightRef ref-guard. Root cause compartilhado #15+#16: axios instance default 'Content-Type: application/json' forçava FormData→JSON → multer rejeitava → ticket nunca persistia. QA prod iPhone Safari-like 390px: 1 POST xhr 202 + redirect /gastos/<receiptId> + toast OCR + supermercado detectado + total 225 cents parseado. #16 GET /receipts/<id> 200 status='ready' errorMessage=null (resolvido junto). Double-fire bloqueado (ref-guard). Nit S229 non-blocker: #17 Combo stale msg 'Mínimo 2' persiste com 2 selecionados.

## Histórico (S170+)
Snapshots: S170-S204 → `docs/archive/sprints-note-2026-11-26.md`. S205-S224 → `docs/archive/sprints-note-2026-11-27.md`. S225-S227 + raw-old → `docs/archive/sprints-note-2026-11-27-b.md`. Entries abaixo são S228+ (append aqui conforme fechamento).
