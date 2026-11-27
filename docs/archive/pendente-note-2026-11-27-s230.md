# Cesta — Pendente

> Snapshot pre-S228 (2026-11-27) em `docs/archive/pendente-note-2026-11-27.md` (657L · 48KB). Entries abaixo são S228+.

## S228 (2026-11-27)

### G0 archive mandatory
Boss 2026-11-27 17:30: cada sprint S228+ archive nota Pendente + Sprints em `docs/archive/` + ponteiros via `note edit`. Reviewer REPROVA se faltar.

Pr #15 dev abaixo cumpre G0 + fix.

### #15 token ausente nota fiscal (P0 rápido)
Branch `fix/s228-15-token-ausente-nota-fiscal`. Root cause provável: `adapter: "fetch"` instance-level + explicit `Content-Type: multipart/form-data` + `onUploadProgress` → Authorization header suprimida em alguns paths (ReadableStream upload via HTTP/1.1 Render). Fix: `adapter: "xhr"` per-request pra upload + remove Content-Type (browser deriva boundary) + adiciona spec.

﻿﻿﻿﻿### Gate 4 PR #211 S229 G3 trigram match + review queue — APROVADO deploy ✅ · --apply PENDENTE ⏳ 2026-11-27 18:42Z

**PR #211 MERGED** 18:41:04Z · Render deploy LIVE uptime=36s pós-restart confirmado.

**Migration aplicada clean (prisma deploy):**
- `20261127190000_sprint229_product_match_review` CREATE TABLE product_match_reviews + 2 FKs (duplicate_product_id + canonical_product_id → products CASCADE) + UNIQUE INDEX (dup, canonical) + INDEX (status, created_at).
- Migration ADITIVA · zero DROP/DELETE · Prisma schema +25 adiciona model ProductMatchReview.
- Render start sem erro (uptime 36s = restart limpo · se migration falhasse, crash loop).

**Pós-deploy sanity 5/5 endpoints 200 ✅:**
- `/api/v1/products?limit=5` → 200
- `/api/v1/supermarkets` → 200
- `/api/v1/products?search=coca zero&limit=3` → 200 (preserva fix #207)
- `/api/v1/products?supermarket=mercadona&limit=3` → 200
- `/health` → 200

**Scripts PR #211 (require DATABASE_URL · QA sem acesso):**
- `audit-trigram-match.mjs` — 3 views: trigram linked + review queue por status + top 29 básicos cross-market match %.
- `match-trigram.mjs` — dry-run default · --apply opt-in · threshold HIGH liga direto · BAIXO-MÉDIO enfileira ProductMatchReview.
- ADR 0039 documenta thresholds + review protocol.

**Boss executa (QA sem acesso DB):**
1. `node scripts/audit-trigram-match.mjs` (pre-apply baseline).
2. `node scripts/match-trigram.mjs --apply` (processa queue).
3. `node scripts/audit-trigram-match.mjs` (post-apply delta).
4. Opcional: UI admin pra revisar fila (sprint seguinte).

**Gate 4 veredito PR #211: APROVADO deploy empírico prod ✅** · migration aplicada clean · zero regressão APIs (5/5 200) · scripts standalone não afetam runtime · --apply pendente Boss decisão PITR.


### Gate 4 PR #210 S229 G1b Mercadona EAN backfill + audit 5 adapters — audit confirmado ✅ · merge+--apply PENDENTE ⏳ 2026-11-27 18:33Z

**PR #210 OPEN** · scripts-only · zero runtime change. Vercel Preview PENDING.

**Pre-merge: audit-adapter-ean-sources.mjs rodado local (read-only público, sem DB) ✅:**

| Adapter | List EAN | Detail EAN | Decisão |
|---------|----------|-----------|---------|
| mercadona | 0/993 (list sem ean) | ✅ `/api/products/4241/` → `ean: "8402001027482"` | **ADD** fetch detail opt-in no adapter (próxima sprint) |
| dia | HTTP 403 (Akamai) | — | GAP G3 trigram |
| lidl | sem JSON embed | — | GAP G3 trigram |
| eroski | sem data-metrics | — | GAP G3 trigram |
| froiz | bare HTML scrape sem schema | — | GAP G3 trigram |

Findings batem com ADR 0038. Script funciona sem credenciais · zero impacto prod.

**Pós-merge + Render deploy (esperado · backend sem mudança · zero regressão):**
- Watcher b7efew6se armado · aguarda merge + confirma `GET /api/v1/products?limit=1` responde 200.
- Scripts standalone não afetam runtime (não importados por serviço · não instalam deps novas).

**Pós Boss `--apply mercadona-backfill` (QA sem DATABASE_URL · Boss executa):**
- Re-run `scripts/audit-ean-coverage.mjs` (criado em S228 #206) esperado mostrar Mercadona `with_ean` crescer de ~0 pra N (N = produtos encontrados no detail endpoint pelo backfill limit).
- DIA/LIDL/Eroski/Froiz continuam 0% (vão pra G3 trigram sprint seguinte · gap documentado ADR 0038).
- Baseline atual API pública: Mercadona 4000 produtos ativos aprox (needs re-sample pós-apply pra confirmar).

**Gate 4 veredito PR #210 pre-merge:** APROVADO audit code + confirmação live script + nenhuma regressão code (scripts isolados) · empírico pós-apply pendente Boss trigger.


### Gate 4 PR #207 fix #7 busca multi-palavra tokenize AND-of-OR — APROVADO ✅ 2026-11-27 18:24Z

**PR #207 MERGED** 18:23:13Z · Render deploy LIVE uptime=23s pós-restart confirmado.

**Teste empírico prod `/api/v1/products?search=<query>`:**

| Query | Pré-#207 | Pós-#207 | First result |
|-------|----------|----------|-------------|
| `coca zero` | **0** ❌ | **19** ✅ | Coca-Cola zero azúcar 1,25 L |
| `coca cola zero` | **0** ❌ | **19** ✅ | Coca-Cola zero azúcar 1,25 L |
| `Coca-Cola Zero` | 17 (hyphen path) | 19 ✅ | Coca-Cola zero azúcar 1,25 L |
| `leche entera` | 33 (control) | 40 ✅ | Chocolate con leche Hacendado almendras enteras |
| `pan integral` | — | 30 ✅ | Barra pan integral 100% |
| `chocolate milka` | — | 14 ✅ | Chocolate con leche Milka 125 g |
| `agua mineral` | — | 74 ✅ | Agua mineral Aquabona 500 ml |
| `queso oveja` | — | 22 ✅ | Deluxe Cuña de queso de oveja añejo |
| `aceite oliva` | — | 126 ✅ | Aceite de oliva 0,4º Hacendado |
| `yogur griego` | — | 27 ✅ | Yogur al estilo griego natural |

**Root cause fix (branch pr-207):**
- `products.repository.ts` L41-62: `buildMultiTokenNameBrandWhere(q)` tokeniza whitespace-split · 2+ tokens produz `AND: tokens.map(t => ({ OR: [name contains t, brand contains t] }))`.
- Antes: single ILIKE `%coca zero%` não achava "Coca-Cola Zero Azucar 2L" (substring literal absent por hífen+"Cola "entre tokens).
- Agora: `AND [name|brand contains "coca"] AND [name|brand contains "zero"]` ✅ match.

**Nit UX observado (non-blocker · defer):**
- `leche entera` top result = "Chocolate con leche Hacendado almendras enteras" (match: contains leche AND contains enteras — matcheia pela proximidade token enteras ≈ entera stem? OR brand contains algum?). Ordering default (sem orderBy explícito) pode não refletir relevância semântica · first hit pode confundir user.
- Melhoria futura (defer): bonus score pra exact-match + consecutive tokens + name-prefix (parcialmente coberto pg_trgm fuzzy fallback S180, mas só dispara em zero-match).

**Zero regressão:**
- Queries single-token (`coca`, `zero`, `leche`) continuam retornando results (preservou comportamento legado).
- `Coca-Cola Zero` com hífen passou de 17 → 19 (ligeiramente expandido, consistente com AND-of-OR mais permissivo via brand).

**Gate 4 veredito PR #207: APROVADO empírico prod ✅** · #7 bug user resolvido (`coca zero` multi-palavra retorna results) + 7 novas queries multi-word validadas · ordering refinamento vai pra backlog nit.


### Gate 4 PR #209 G2 canonical merge EAN — deploy live ✅ · --apply PENDENTE ⏳ 2026-11-27 18:20Z

**PR #209 MERGED** 18:19:11Z · Render deploy LIVE (uptime=41s pós-restart confirmado).

**Pós-deploy sample multi-market (zero regressão esperada sem --apply):**
- Sample 800 produtos pages 1,2,3,10,25,50,75,100.
- Distribuição prices.length: `{"1":798,"7":2}` — idêntica ao baseline pre-#209.
- Confirma zero regressão schema/upsert em prod ✅.

**--apply PENDENTE (QA sem DATABASE_URL · Boss executa):**
- Script `scripts/merge-canonicals.mjs --apply` precisa Boss/Dev rodar contra prod DB (requires DATABASE_URL).
- Dry-run default imprime candidates antes de gravar.
- Boss guard 3 (PITR snapshot Neon) destravado — ok pra prosseguir.
- Pós-apply esperado:
  - `canonicalProductId` populado em duplicatas (ean=NULL mesma normalized_name).
  - Sample multi-market dist deve shift: `1: 798 → menos`, novos buckets `2+: >0` aparecem conforme catalog-sync renova prices para canonicals.
  - **Nota**: merge-canonicals.mjs LIGA duplicatas via canonical_product_id · NÃO move ProductPrice records. Dist API `/api/v1/products` pode continuar refletindo prices per-record · UI G4 vai agregar por canonical. QA re-sample confirma apenas se endpoint filtra `canonical_product_id IS NULL` OR agrega.

**QA empírico pós-apply (quando Boss trigger):**
- Re-run sample 800 produtos · dist delta.
- Verificar coca-cola zero scan (reteste original mostrou 19 records → esperado agregar após merge em menos canônicos com prices multi-mercado).
- Confirmar nenhum produto duplicado visível em busca user.

**Gate 4 veredito PR #209:** APROVADO deploy · empírico --apply pendente Boss trigger.


### Gate 4 PR #208 fix #15b upload + #16 desbloqueado — APROVADO ✅ 2026-11-27 18:05Z

**PR #208 MERGED** 7672cfc 18:02:51Z · Vercel prod live · scope: Content-Type override + inflightRef ref-guard.

**Teste empírico prod mobile 390px (user fresh `gabriel_dutra98+qa228u1795802705@hotmail.com`):**

**Criterio 1 — Upload nota real funciona ✅:**
- Fluxo: register → login → /gastos → upload ticket.jpg (16KB JPEG válido com texto "MERCADONA TICKET / PAN 1.20 EUR / LECHE 1.05 EUR / TOTAL 2.25 EUR") → click "Enviar".
- Network: `POST /api/v1/receipts` **xhr 202** ✅ (antes #208: xhr 400 "Imagem é obrigatória").
- Toast: "Nota enviada, processando OCR…" ✅.
- Auto-navigate `/gastos/cmwzal0ur000dhijndhip7xhz` (receiptId do POST response) ✅.
- UI detail: header "Ticket" + imagem preview + spinner "Processando OCR..." + delete icon.

**Criterio 2 — Double-fire bloqueado ✅:**
- Network timing 1 click "Enviar" → **1 POST /receipts xhr 202** + 1 GET detail subsequente (fetch 200, não é double-POST — é load page detail).
- Antes #208: 1 click = 2 POST (fetch 200 + xhr 400). Agora: single POST.
- Fix `inflightRef.current` em scan-button.tsx bloqueia race sync antes isPending propagar.

**Criterio 3 — #16 desbloqueado ✅:**
- `GET /api/v1/receipts/cmwzal0ur000dhijndhip7xhz` prod Bearer → **200**:
  ```
  {"data":{"id":"cmwzal0ur000dhijndhip7xhz","status":"ready",
   "errorMessage":null,"supermarketSlug":"mercadona",
   "supermarketName":"Mercadona","purchaseDate":null,"total":225,
   "imageUrl":"/uploads/1795802738063-213abbd5d9a9873c1239e3a5.jpg",
   "items":[],"createdAt":"2026-11-27T18:05:38.067Z"}}
  ```
- Status `"ready"` (não "processing" — OCR worker rápido ~5s pós-upload).
- Supermercado detectado OCR = `mercadona` ✅ (image text "MERCADONA TICKET" parseou).
- `total: 225` (OCR pegou "TOTAL 2.25 EUR" → 225 centavos).
- `items: []` (OCR text layout simples não extraiu line-items · esperado pra imagem dummy mínima).
- NENHUM "no encontramos este ticket" ❌ → bug #16 user report NÃO reproduz mais ✅.

**Root cause fix análise:**
- Service `expenses.service.ts`: `headers: { "Content-Type": "multipart/form-data" }` override per-request → axios `transformRequest` default vê Content-Type sem 'json' → NÃO converte FormData em JSON. Depois `resolveConfig` vê FormData + browser env → chama `setContentType(undefined)` → browser seta nativamente `multipart/form-data; boundary=...` no XHR send.
- Scan-button `inflightRef = useRef(false)` + onSettled reset → React Query `mutate` sync race resolvida sem depender do `isPending` re-render delay.

**Zero regressão observada:**
- Register + login + navegação + perfil + categorias home intactos.
- Toast success + redirect ticket detail funcionando.

**Gate 4 veredito PR #208: APROVADO empírico prod ✅** · 3 critérios Boss batidos (upload real + no double-fire + #16 desbloqueado). Fix definitivo #15 + #16 shipped juntos.

**Nota liftada:** Feedback QA original reportou #15 "Token ausente" e #16 "procesando → no encontramos" como bugs distintos. Root cause compartilhado: **Content-Type: application/json default do axios instance forçava serialização incorreta da FormData**. #15 superficial (ReadableStream + fetch adapter) + #16 downstream (FE nunca conseguia POST válido = ticket nunca aparecia = "no encontramos" via teste user). #208 cirurgia correta no nível raiz.

**#17 nit pendente (defer S229):** PR #205 alertas Combo `"Combo precisa de 2+ produtos"` alert persiste mesmo com 2 chips selecionados. Non-blocker UX.


﻿### Gate 4 PR #206 Aldi EAN — update pós-deploy 2026-11-27 18:09Z

**PR #206 MERGED** 18:08:07Z · Render deploy LIVE (uptime=24s pós-restart confirmado).

**Baseline Aldi pós-deploy (sem sync novo rodar):**
- Full catalog sampled 6 pages × 100 = 582/582 produtos.
- EAN filled: **0** · EAN null: **582** (0% coverage).
- Esperado: fix adapter só popula EAN em NOVOS syncs (cron OR manual-trigger).

**Trigger pendente (fora QA role):**
- Boss admin POST `/api/v1/admin/catalog-sync/aldi/run` dispara job BullMQ (status via GET /admin/catalog-sync/runs?supermarket=aldi).
- OU cron daily aldi 07:00 CET amanhã 2026-11-28 (routine S225 ADR 0033).
- QA re-sample pós-sync confirmar `with_ean > 0` em produtos recém-sincronizados · esperado mescla cross-mercado destravada G2.

**Fix code ativo (verificado branch pr-206):**
- aldi.adapter.ts L266-267 extract chain gtin13→12→gtin→gtin8.
- Zero regressão expected — spec 4 novos tests + 11 existentes pass CI.


### Gate 4 PR #206 Aldi EAN audit + ADR 0036 — APROVADO code ✅ · empírico sync PENDENTE cron/trigger ⏳ 2026-11-27 17:50Z

**PR #206 OPEN** (CI in-progress). Scope: aldi.adapter.ts extrai gtin13→12→gtin→gtin8 JSON-LD · audit-ean-coverage.mjs expande 3 views · ADR 0036 documenta 4 gaps (DIA/Eroski/Froiz/LIDL = G3 trigram).

**G1 Code review ✅ (branch pr-206 lido):**
- `aldi.adapter.ts` L266-267: `this.asString(product.gtin13 ?? product.gtin12 ?? product.gtin ?? product.gtin8)` · fallback chain prioriza EAN-13 europeu padrão Aldi.
- `asString` helper (nova L273+): converte JSON number → string (schemas às vezes retornam número).
- `ProductDb.ean` propagado em `fetchProducts()` output L119 · upstream catalog-sync upsert agora pode match por EAN.
- Zero mudança em outros adapters (correto — PR scope só Aldi G1 fix + script + ADR).

**G2 Spec coverage ✅ (aldi.adapter.spec.ts +135 adicionais):**
- `S228 G1: extrai gtin13 → ean populado` (happy path · ean "4061458000013")
- `S228 G1: fallback cadeia gtin13→gtin12→gtin→gtin8 (não nulos)` (4 produtos distintos)
- `S228 G1: gtin13 prioridade sobre gtin12/gtin/gtin8 quando múltiplos presentes`
- `S228 G1: gtin numérico JSON (não string) convertido → ean string`

**G3 Audit script 3 views ✅ (scripts/audit-ean-coverage.mjs):**
- `globalCoverage`: % EAN populado per adapter (slug · total · with_ean · without_ean · coverage%).
- `missingImageBreakdown`: produtos sem imagem com/sem EAN per adapter (legado path).
- `multiMarketMatch`: total · single_market · multi_market (baseline G4 Boss roadmap).
- Script lê DATABASE_URL de env OR cesta-api/.env · Prisma `$queryRawUnsafe` SQL puro · WHERE `s.is_active=true`.

**G4 Baseline empírico prod (QA via API externa):**
- Aldi total 582 produtos ativos.
- Sample 300/300 Aldi via `/api/v1/products?supermarket=aldi`: **EAN filled=0 / null=300 (0%)** · confirma gap pré-fix.
- Multi-market prod sample 800 (pages 1-100 stride): 798 em 1 mercado só (99.75%) · 2 em 7 mercados (seed).

**ADR 0036 ✅:**
- Audit per adapter: mercadona API ✅ · alcampo gtin JSON-LD ✅ · carrefour raw.ean ✅ (3 ok pré-S228) · aldi fix (S228) · dia/eroski/froiz/lidl → G3 trigram (gap documentado · requer sprint própria).
- Explicação exact fix + sem speculative changes.

**Empírico sync pendente (bloqueia veredito APROVADO completo):**
- QA NÃO tem admin role → não dispara `POST /api/v1/admin/catalog-sync/aldi/run` (requer @Roles('admin')).
- Opções pra fechar empírico:
  - (a) Boss trigger manual-sync admin pós-merge → aguardar job complete → re-sample Aldi EAN coverage · esperado > 0% em novos produtos sincronizados.
  - (b) Esperar cron daily Aldi 07:00 CET amanhã 2026-11-28 (routine S225 ADR 0033) · sample após.
- Audit script empírico requer DATABASE_URL prod (não disponível pra QA) · roda só se Boss executa local com env prod OR CI/scheduled.

**Zero regressão sync Aldi (preview):**
- Spec +135 -17 (additive · zero existing test removido).
- Sitemap crawl + detail fetch + ofertas overlay inalterados (lines 1-109 adapter).
- Novo campo `ean` opcional no ProductDb · upsert aceita null · adapters existentes já retornam ean quando disponível.

**Gate 4 veredito PR #206:** **APROVADO code + spec + baseline** · empírico sync-time pendente (Boss admin-trigger OR cron amanhã) · follow-up nota Sprints G4 métrica "multi_market %" post-first-sync aldi + eventual G2-G4 sprints.


### Gate 4 PR #205 fix #17 alertas 1-produto UX — APROVADO ⚠️ (nit stale) 2026-11-27 17:47Z

**PR #205 MERGED** 17:44:41Z · Vercel prod live · scope: wizard default = Tendência (1 produto) · Combo secondary · msg + placeholder cleanup.

**Teste empírico prod mobile 390px (user `gabriel_dutra98+qa228p1795801151@hotmail.com`):**

**G1 Ordem opções `/alertas/novo` ✅:**
- `@e4` **Tendência de queda · Um produto, N semanas seguidas em queda** (DEFAULT 1º)
- `@e5` Combo dentro do orçamento · Vários produtos, soma ≤ alvo
- `@e6` Economia entre mercados · Mesmo carrinho, escolhe mercado mais barato

ANTES #205: ordem era Combo (1º) → Tendência (2º) → Economia (3º). User forçado a escolher "Mínimo 2" primeiro. AGORA Tendência 1º = user single-produto escolhe sem fricção ✅.

**G2 Tendência (1 produto) ✅:**
- Form mostra: `ID do produto (cuid)` text input + `Semanas consecutivas (2–12)` number input.
- Fill cuid real `cmwnyj1c40gkv28gpxdctr31z` (Coca-Cola 1,25 L DIA) + default 2 semanas + click "Criar regra".
- Redirect `/alertas` + toast **"Regra criada"** + alerta listada com Desativar/Excluir.
- **Criar alerta 1 produto funciona ✅** (requisito Boss cumprido).

**G3 Combo — msg + placeholder cleanup ✅:**
- Pré-submit (zero produtos adicionados): **alert "Mínimo 2 productos" NÃO aparece** ✅ (antes aparecia instantâneo ao abrir form).
- Com 1 produto selecionado: alert mostra "Combo precisa de 2+ produtos. Para 1 só, use Tendência de queda." · **msg bidirecional didática** ✅ (user aprende que existe opção Tendência).
- Placeholder Total agora `"0.00"` (vs anterior `"10.00"`). Mais semântico "vazio" · reduz confusão com default preenchido ✅.
- Validação total: tentar crear vazio → novo alert "Combo precisa de 2+ produtos..." (tratamento adequado).

**G4 Criar Combo (fluxo completo) ✅:**
- Add 2 produtos (Leche entera brik 1L + Pan de barra 250g) · fill Total "5" · click "Criar regra".
- Redirect `/alertas` + toast "Regra criada" + **2 alertas listadas** (Tendência + Combo).

**AJUSTE nit non-blocker (defer S229 OR flag Dev):**

- **Stale validation message persist com 2 produtos selecionados ❌:**
  - Após adicionar 2 chips (`Leche entera brik 1L` + `Pan de barra 250g` visíveis @e5/@e6) · alert @e10 **AINDA mostra** "Combo precisa de 2+ produtos. Para 1 só, use Tendência de queda."
  - Expected: alert some quando `productIds.length >= 2`.
  - Actual: alert fixo até submit success.
  - Severidade LOW (não bloqueia criar · user confunde mas não impede).

**Gate 4 veredito PR #205: APROVADO** (com 1 nit non-blocker). Requisito Boss cumprido: default Tendência 1 produto · Combo secundário acessível · criar 1 produto funciona · msg "Mínimo 2" pré-submit removida · placeholder 10.00 → 0.00. Única pendência: stale alert em Combo com min atingido.

---

### #16 ticket procesando → no encontramos — NÃO REPRODUZIDO via API ✅ 2026-11-27 17:47Z

**Hipótese Boss "double-fire causa comum #15" → PARCIALMENTE REFUTADA pra #16:**

Receipt criado via probe direct (Teste 2 QA #204 seção): id `cmwz9qm4s000d4zr3k2jblelh` jobId `7`.

**GET `/api/v1/receipts` (list) prod com Bearer → 200:**
```
{"data":[{"id":"cmwz9qm4s000d4zr3k2jblelh","status":"failed",
 "errorMessage":"Input file has corrupt header: VipsJpeg...",
 "supermarketSlug":null,"supermarketName":null,"purchaseDate":null,
 "total":null,"imageUrl":"/uploads/1795801319256-95faefdf397d941eabb7f528.jpg",
 "items":[],"createdAt":"2026-11-27T17:41:59.260Z"}]}
```

**GET `/api/v1/receipts/cmwz9qm4s000d4zr3k2jblelh` (detail) prod com Bearer → 200:**
- Mesmo payload com `errorMessage` populado (dummy jpeg 12 bytes do probe tinha JPEG header mas sem image data real — worker Sharp/vips rejeitou corretamente).
- `status: "failed"` (não "processing", worker processou).
- Backend NÃO retorna 404 · ticket está no DB · acessível por id.

**Interpretação:**
- Backend READ path (list + detail) NÃO quebrado.
- #16 user bug ("procesando → no encontramos") pode ser:
  - **Race condition front-end**: FE navega pra `/gastos/<id>` ANTES do worker BullMQ persistir `receiptId` (window curta · pouco provável se FE usa receiptId direto da resposta POST).
  - **jobId vs receiptId mix-up front-end**: FE armazena `jobId` (ex: "7") e constrói URL `/gastos/7` que não é receiptId (cuid) · GET retorna 404 "no encontramos". Necessita teste UI com upload válido + navegação observada.
  - **Session mismatch**: user logado em dispositivo A upload · abre em dispositivo B · token diferente · receipt belongs to A · B vê "no encontramos".

**#16 BLOCKED teste UI empírico:**
- Upload UI ainda quebrado (#204 fix parcial · POST retorna 400 "Imagem é obrigatória" por Content-Type default header do axios instance — ver seção Gate 4 PR #204 acima).
- Precisa: #15 upload FE realmente funcional (follow-up PR corrigindo `headers: {"Content-Type": undefined}` em uploadReceipt) → então repetir fluxo UI completo pra ver se FE confunde jobId/receiptId.

**Veredito #16:** NÃO reproduzido via API · backend OK · bug provavelmente UI-only (jobId↔receiptId confusion) OR race condition fugaz difícil reproduzir sem iPhone Safari real. Flag Dev investigar handler pós-upload em scan-button.tsx / use-expenses.ts.


### Gate 4 PR #204 fix #15 upload — AJUSTE ⚠️ 2026-11-27 17:42Z

**PR #204 MERGED** af82f44 17:35Z · Vercel prod live · fix web-only `adapter: "xhr"` per-request em uploadReceipt.

**Teste 1 QA — PREVIEW URL `cesta-web-git-fix-s228-15-tok-ec6e4f...vercel.app` (mesmo user antigo):**
- 1 click "Enviar" → 2 POST /api/v1/receipts. Fetch 200 + xhr 429 (rate-limit herdado sessão anterior).
- UI: "Reintentar" + toast "Has subido demasiados tickets. Intenta en 1 hora."
- Rate-limit NestJS Throttle({default:{limit:5,ttl:3_600_000}}) por IP, não user.

**Teste 2 QA — PROD cesta-web.vercel.app (user fresh `gabriel_dutra98+qa228p1795801151@hotmail.com`):**
- 1 click "Enviar" → 2 POST. **Fetch 200 @1.6s · xhr 400 @12.8s** (gap 11s suspeito retry).
- UI: botão "Tentar novamente" + mensagem "Imagem é obrigatória" vermelha abaixo thumbnail (preview 16KB ticket.jpg visível).
- GET /receipts Bearer → `data:[]` (receipt NÃO persistido).

**Veredito "Token ausente" ELIMINADO ✅:** mensagem literal `Token ausente` NÃO aparece mais no UI toast nem error text. Fix do bug #15 nominal específico atingiu objetivo.

**Novo bug exposto: UPLOAD AINDA QUEBRADO · root cause DIFERENTE da hipótese do PR body:**

Probe direct via portal evaluate (fetch nativo, não axios):
- POST /receipts com `FormData.append("image", blob, "probe.jpg")` + `Authorization: Bearer <tok>` → **202** `{"data":{"jobId":"7","receiptId":"cmwz9qm4s000d4zr3k2jblelh","status":"queued"}}` ✅ (backend SPEC-CORRETO + produz jobId+receiptId per CLAUDE.md "Endpoint de upload de nota retorna 202 + jobId").
- POST /receipts com FormData vazio (sem `image` field) → **400** `{"message":"Imagem é obrigatória","errorCode":"RECEIPTS.FILE_REQUIRED"}`.
- POST /receipts com field `wrong_field_name` em vez de `image` → **400** `{"message":"Unexpected file field - wrong_field_name"}`.

**Conclusão:** backend funciona + aceita 202 quando body está correto. FE não envia o campo `image` corretamente.

**Root cause real do upload FE quebrado (web-only, backend OK):**

`cesta-web/src/lib/api.ts` L13:
```
export const api = axios.create({
  ...
  headers: { "Content-Type": "application/json" },
  adapter: "fetch",
  ...
});
```

Instance default `Content-Type: application/json` **não é overridden** em `uploadReceipt`. Axios xhr adapter respeita o header explícito → tenta serializar FormData como JSON → body vazio ou `"{}"` → multer no backend vê zero multipart file → retorna exato "Imagem é obrigatória".

PR body dizia "Content-Type explícito removido pro browser derivar boundary" — **MAS não há override** no `uploadReceipt` config. O `removeContentType` precisa ser explícito tipo:
```ts
headers: { "Content-Type": undefined }
// OU
transformRequest: [(data) => data]  // skip JSON.stringify
```

**Tratamento Spec 200 vs 202:**
- Antes gate 4: performance.getEntriesByType reportava POST #1 como `status: 200`. ESTAVA INCORRETO — API resource timing retorna stale/preflight status pra CORS requests.
- Probe direct empírico: backend retorna **202 real** com jobId+receiptId. Spec adherence CONFIRMADO ✅.

**Double-fire POST (bug A original persiste):**
- 1 click "Enviar" dispara 2 POST /receipts: fetch 200 a 1.6s + xhr 400 a 12.8s.
- Hipótese: React Query / axios interno retry OR scan-button useMutation efeito duplo. Dev precisa investigar `scan-button.tsx` submit + use-expenses hook.

**Nova lista bugs (ordem prioridade):**

1. **P0 upload FE still broken:** body JSON-serialize FormData · fix precisa `headers["Content-Type"]: undefined` ou `transformRequest` passthrough em `uploadReceipt` config.
2. **P0 double-fire POST:** 1 click = 2 requests + 11s gap suspeito. Dev investiga retry path.
3. **P2 resource timing misleading 200 vs 202:** não é bug (browser quirk cross-origin) · afeta debugging mas user não vê.

### Evidência adicional screenshot
- `C:\Users\gabri\AppData\Local\Temp\maestri-portal-2c1d3ac6-5770-4645-84aa-8c219d3566c0.png` captura prod /gastos com "Imagem é obrigatória" vermelho + "Tentar novamente" verde.

### Status #16 ticket procesando — ainda BLOCKED

- Fix #15 não permite upload chegar a estado "processando" (POST 400 sempre). #16 reteste depende de fix root cause (item 1 acima) landing primeiro.
- Hipótese Boss "double-fire causa comum" NÃO confirmada: double-fire persist em #204 mas single POST válido (probe direct) cria receipt com sucesso + retorna 202 + receiptId. #16 user bug pode ser race entre criar receiptId (worker BullMQ em `queued`) e dashboard navegar /gastos/{id} antes de worker atualizar status → 404.

**Gate 4 veredito final PR #204: AJUSTE** · fix nominal #15 "Token ausente" eliminado ✅ · mas upload continua quebrado com erro diferente (400 Imagem é obrigatória por Content-Type default do axios instance não overridden). Precisa follow-up PR correto root cause antes do user conseguir upload de nota real.


### Reteste oficial (QA Tester empírico) 2026-11-27 17:30Z

QA Tester reproduziu bugs P0 em prod mobile 390px (portal Cesta Mobile · https://cesta-web.vercel.app · backend https://cesta-gsvc.onrender.com). Sessão nova registrada `gabriel_dutra98+qa228r1795800161@hotmail.com` 17:22Z. Locale ES default.

### P0 · #9/#10/#11 MATCHING CROSS-MERCADO — CONFIRMADO empírico ✅

**Método:** API prod `/api/v1/products?limit=100&page=N` pages 1,2,3,10,25,50,75,100 → sample 800 produtos.

**Evidência:**
- `Product.ean` 100% null/empty (**0/800 filled**).
- Distribuição `prices.length`: **798/800 em 1 mercado só (99.75%)** + **2/800 em 7 mercados** (seed inicial 7-wide).
- `total` payload = **10980 produtos** · 8 supermercados ativos.
- Boss baseline 10936/10980 em 1 só · 27 em 7 batem com sample.

**Coca-Cola Zero cross-market scan (brand `Coca`/`COCA`/`cola`):**
- 19 registros distintos com nome contendo "coca"+"zero".
- Markets breakdown: 15 DIA · 2 Mercadona · 1 LIDL · 0 shared cross-market.
- Ex `Coca-Cola zero azúcar 2 L` = **DIA only**. `COCA-COLA Refresco de cola Zero` = **LIDL only**. `Refresco Coca-Cola Zero azúcar` = **Mercadona only**. Cada mercado cria registro próprio.
- Ação: Boss roadmap G1 audit EAN por adapter + G2 merge por EAN + G3 pg_trgm sem EAN.

### P0 · #7 BUSCA MULTI-PALAVRA quebrada — CONFIRMADO empírico ✅

**Evidência (API direta):**
- `?search=coca%20zero` → `total:0` ❌
- `?search=coca%20cola%20zero` → `total:0` ❌
- `?search=coca` alone → results ✅ (hit "Coca-Cola 1,25 L" + "COCA-COLA Refresco de cola Zero" entre outros)
- `?search=zero` alone → results ✅ (ex "7 Up zero 330 ml")
- `?search=Coca-Cola%20Zero` (com hífen) → results ✅
- Controle `?search=leche%20entera` → `total:33` ✅ (2-word com space funciona em outros termos)

**Root cause suspeito (dev confirma):** tokenização trata `coca-cola` como single token + AND-join quebra pra token "coca" isolado quando combinado com outro termo. Hífen case-sensitive quebra match.

### P0 · #15 TOKEN AUSENTE upload nota fiscal — CONFIRMADO root cause ✅

**Repro passos:** register novo user → /gastos → "Subir imagen" (@file input accept=image/jpeg,png,webp,heic) → upload 32x30 JPG dummy → click "Enviar".

**Evidência network (performance.getEntriesByType):**
- 1º click "Enviar" → **2 POST /api/v1/receipts disparados** sequencialmente.
- POST #1: `status 200 dur=517ms` (token OK, aceito).
- POST #2: `status 429 dur=703ms` (rate-limited).
- Toast UI: `"Has subido demasiados tickets. Intenta en 1 hora."` + estado "Reintentar".

**Evidência backend 401:** GET `/api/v1/receipts` com `credentials:'include'` (só cookie sem Bearer) → `401 {"message":"Token ausente","error":"Unauthorized"}`. **String literal "Token ausente" é a mensagem backend para 401** → é o que user vê no iPhone Safari quando ITP perde o cookie/localStorage de sessão.

**Bugs correlatos descobertos:**
- (a) **Double-fire POST:** 1 click = 2 requests → segunda hit rate-limit → user vê msg errada "demasiados tickets" após 1 ação legítima.
- (b) **Spec divergência:** CLAUDE.md "Endpoint de upload de nota retorna 202 + jobId" · prod retorna **200** (não 202). FE provavelmente espera 202 e trata 200 como erro → re-POST → 429.
- (c) `/gastos` dashboard sem lista de tickets históricos UI visível — só uploader. GET /receipts com Bearer retorna `data:[]` apesar do 200 no POST → persistência duvidosa.

### P0 · #16 TICKET PROCESANDO → NO ENCONTRAMOS — BLOQUEADO reproduzir ⚠️

**Motivo:** rate-limit 1h disparado pelo double-fire POST do #15 na mesma sessão QA. /receipts list vazio pós-upload (data:[]) sugere ticket não persistiu apesar do POST 200.

**Hipótese ligada a #15:** se receipt criou com status "processing" mas detail endpoint `/receipts/:id` 404 (not found) por race entre dashboard polling e worker BullMQ · OR FE armazena jobId que não vira receiptId.

**Reteste:** janela 1h (18:25Z CET ~hoje) OR novo user.

### P0 · #17 ALERTA Combo exige 2 produtos + validation UX — CONFIRMADO ✅

**Repro:** /alertas/novo → "Combo bajo tu presupuesto".

**Bug (a) Mínimo correto por design, mensagem agressiva:** input começa sem produtos → mostra `alert "Mínimo 2 productos"`. Correto por regra (Combo = conjunto). Issue UX: user não entende que deve voltar e escolher "Tendencia de bajada" (1 produto) se quiser alerta de um só item.

**Bug (b) Stale validation message:** adicionei 2 produtos ("Leche entera brik 1L" + "Pan de barra 250g") · chips visíveis @e5/@e6 "Quitar X" · porém `alert "Mínimo 2 productos"` **permanece** até submit tentativa. Confusing feedback.

**Bug (c) Placeholder confundido com valor:** input "Total objetivo (€)" tem `placeholder="10.00"` cinza. User lê como valor default preenchido. Submit sem digitar nada → novo alert `"Total debe ser > 0.01 €"`. Fix: usar `defaultValue="10.00"` OU placeholder diferente ("Ex: 10.00" ou vazio).

**Crear FUNCIONA após corrigir:** fill `@e9` "5" → click "Crear regla" → redirect `/alertas` + toast `"Regla creada"` ✅. Alerta persiste no listing.

### Resumo severidades (reteste oficial)

| # | Severidade | Status | Rota | Evidência |
|---|-----------|--------|------|-----------|
| 9/10/11 | BLOCKER | CONFIRMED | /api/v1/products | EAN 100% null · 99.75% em 1 mercado · 0 dup cross-market Coca-Cola Zero |
| 7 | HIGH | CONFIRMED | /api/v1/products?search | `coca zero` → 0 · `leche entera` → 33 · hyphen tokenization |
| 15 | HIGH | CONFIRMED | POST /receipts | 401 body = "Token ausente" + double-fire 1 click=2 POST + spec 202 vs real 200 + /receipts data:[] apesar 200 |
| 16 | HIGH | BLOCKED | /gastos | rate-limit 1h · hipótese race jobId↔receiptId |
| 17 | MEDIUM | CONFIRMED | /alertas/novo | stale validation "Mínimo 2" com 2 selecionados + placeholder "10.00" induz erro |

### Fluxos obrigatórios QA não executados (restantes bundle P1+P2 e retestes empíricos)

- Favorito criar/listar/remover (passa smoke code-identidade S215)
- Minha Lista criar + 5 produtos + comparativo mercados
- Cesta Familiar wizard completo
- Gastos dashboard pós rate-limit expiração
- #14 OCR lento Mercadona
- #1/#2 perf Web Vitals · #3 busca dentro lista · #4 toque produto detalhe · #12 /comparar persistência · #13 tabela comparar mobile

Boss ordem foi priorizar P0 bugs rápidos · P1/P2 restantes separada sprint.

---

*QA Tester · 2026-11-27 17:30Z-ish · prod empírico 390px Chromium portal · sessão QA S228 reteste oficial.*


## Próximos defer/parked
(Vai sendo preenchido conforme sprints evoluem.)
