# ADR 0003 — Import de dados pessoais via ZIP CSV (Sprint 102)

- **Status:** Accepted
- **Date:** 2026-11-18
- **Deciders:** Gabriel Dutra (owner), Claude Code (dev)
- **Supersedes:** —
- **Supersedido por:** —

## Contexto

Sprint 91 entregou export GDPR Art. 20 (ZIP multi-CSV: perfil, favoritos, listas, alertas, reviews, expenses). Não existe caminho simétrico: user que migra de conta (teste → prod, ou pessoa física A → pessoa física B) não consegue reaproveitar favoritos/listas/alertas/reviews já curados. Frustração real: usuário beta pediu explicitamente ("exportei mas não tem como importar de volta").

Também abre porta a workflow power-user: editar CSV em Excel/LibreOffice e reimportar listas em lote (bulk add a Minha Lista).

Restrições:
1. GDPR — user só importa pros próprios dados (`/users/me/import`); jamais mexe em outro userId.
2. Preços nunca escrevem pelo frontend (regra CLAUDE.md). Import de favoritos/listas/alertas aponta pra `productId` já no catálogo; import NÃO cria Product nem ProductPrice.
3. Expenses importa `Receipt + ReceiptItem` mas `supermarketSlug` é referência leve; não cria Supermarket.
4. Idempotência obrigatória: user pode clicar Aplicar duas vezes (rede flaky) sem duplicar.
5. Budget de carga: ZIP máx 5 MB, worker com concurrency 1 por queue.

## Decisão

1. **Two-step flow (dry-run → apply)** em vez de upload-e-executa. Motivos:
   - User precisa ver summary (quantos favoritos novos, quantos skipped por já existirem, quantos errors Zod) antes de commit.
   - Diminui ansiedade GDPR (user vê o que vai acontecer).
   - Technical: mesmo worker roda duas vezes com flag `apply=false|true` — código único.

2. **Endpoint set `/users/me/import`** (NOT `/imports`). Scope explícito "só eu". URL carrega semantics do dono — guard checa `userId` do JWT contra `Import.userId` em GET/POST apply.

3. **BullMQ worker `import-csv-user`** com concurrency 1. Motivo: parse ZIP + 6 CSVs + validações Zod + dedupe queries é CPU+IO pesado; melhor serializar.

4. **Rate limit 1 import/hora/user** (`@Throttle({ strict: { limit: 1, ttl: 3_600_000 } })`) — mesmo throttler do export Sprint 91. GDPR não-abusivo + proteção worker.

5. **Max ZIP 5 MB** via `MulterModule.limits.fileSize`. Suficiente pra exports realistas de user ativo (export S91 benchmark Gabriel: 18 KB com 3 anos de uso simulado).

6. **Dedupe por chave natural** (não gera jobId de linha; dedupe é query-based):

   | Tabela | Chave natural | Behavior se existe |
   |---|---|---|
   | Favorite | `(userId, productId)` | skip, não erro |
   | ShoppingList | `(userId, listName)` | reusa a lista existente; items novos entram |
   | ShoppingListItem | `(listId, productId)` | skip |
   | Alert | `(userId, productId, type)` | skip (não atualiza targetPrice) |
   | Review | `(userId, productId)` | skip (user já reviewou; não sobrescreve) |
   | Receipt | `(userId, purchaseDate, total)` como fuzzy key | skip (match ±1h e ±€0.01) |
   | ReceiptItem | sempre insere (se Receipt é novo) | — |

7. **Produto não encontrado = skip, não erro.** Import pode vir de outra conta em outra versão do catálogo — productId pode ter sumido. Summary conta em `productsNotFound`; user vê "N favoritos ignorados — produtos não disponíveis".

8. **CSV parser inline minimal** (sem dep nova). Formato é o produzido por `users-export.util.ts`: RFC 4180-ish com BOM + CRLF + double-quote escape. ~40 linhas de código em `imports-parse.util.ts`; testado com fixture. Alternativa `csv-parse` npm dep foi rejeitada pra manter surface mínima.

9. **Validação Zod por linha**. Erros não derrubam o job — vão em `summary.errors[]` com `{ file, line, message }`. Usuário vê quais linhas falharam e por quê.

10. **Zip persistido em disco** durante window dry-run → apply. `Import.zipPath` guarda caminho em `./uploads/`. Worker apply relê mesmo path. Cleanup: processor remove file ao atingir status `complete | failed`.

## Alternativas consideradas

- **Upload-e-aplica direto (sem dry-run).** Rejeitado: user não vê preview, e mistakes de dedupe (ex: lista "Compras" vira duplicata se dedupe falhar) ficam caros.
- **Job por tabela** (6 jobs paralelos em vez de 1 serial). Rejeitado: dedupe cruzado (list → items → productId) força ordem; concorrência não traria ganho mensurável pra ZIPs ≤ 5 MB.
- **Importar perfil (nome/locale/preferências dietéticas)**. Rejeitado: user já tem perfil ativo; sobrescrever é destrutivo e confuso. Fora de escopo S102.
- **JSON em vez de CSV**. Rejeitado: export S91 é CSV por motivo (abrir em Excel). Simetria > mudança de formato.
- **Supabase storage / S3 pra ZIP**. Rejeitado: disk local do Render é suficiente (ZIP vive <2min entre upload e apply; não precisa persistir).

## Consequências

Positivas:
- User migra entre contas sem perder curadoria. Reduz churn de beta testers.
- Power-user workflow: editar CSV e importar em bulk.
- Simetria com export cria contrato GDPR natural ("exportei isso, posso reimportar").
- Dedupe idempotente permite retry seguro em rede flaky.

Negativas:
- Worker adicional na queue BullMQ (+1 concurrency slot ocupado durante import). Mitigado: concurrency 1 + rate limit 1/hora limita carga a 1 import ativo por hora global máximo.
- Zip em disco durante window dry-run → apply. Mitigado: cleanup imediato em finish; cron nightly varre uploads/ > 1h sem Import row ativa.
- productsNotFound ambíguo pro user ("por que perdi favoritos?"). Mitigado: UI mostra contagem com tooltip explicando.

## Observabilidade

- Sentry tag `module: imports` em erros.
- Breadcrumbs: `import.enqueued`, `import.parsed`, `import.ready_to_apply`, `import.applying`, `import.complete`, `import.failed` (com `userId + jobId` no data).
- Audit log estruturado: `[audit] UserDataImported userId=... jobId=... added=... skipped=...` em cada transição complete.

## Segurança / GDPR

- Guard verifica `Import.userId === req.user.id` em GET + apply.
- `zipPath` nunca retornado em response (só server-side).
- Rate limit 1/hora bloqueia user hostil enchendo worker.
- Sem write em outra tabela além das do próprio user (favoritos/listas/alertas/reviews/receipts). Zero touch em Product/ProductPrice/Supermarket.
- Session Replay `maskAllInputs: true` cobre UI (file picker já é mascarado por padrão).
- Summary não vaza PII em logs: só contagens (`{added: {favoritos: 3, ...}, skipped: {...}}`).

## Testes (Jest — mínimo 3)

1. `imports-parse.util.spec.ts` — parse ZIP válido Sprint 91 shape → extrai 6 arrays Zod-validated.
2. `imports.processor.spec.ts` — dry-run gera summary sem write; apply escreve DB; segundo apply idempotente (dedupe pega tudo).
3. `imports.service.spec.ts` — malformed zip → `IMPORT.MALFORMED_ZIP` 400; rate limit 2ª chamada 429.

## Acceptance Criteria (Given / When / Then — DoD Sprint 102)

1. **Given** zip válido Sprint 91 shape (favoritos.csv, listas.csv, alertas.csv, reviews.csv, expenses.csv), **when** `POST /users/me/import` com `dryRun=true`, **then** resposta 202 + `jobId` + status=pending; worker transiciona pra ready_to_apply com summary preview; nenhum write em Favorite/ShoppingList/Alert/Review/Receipt.
2. **Given** dry-run complete (status=ready_to_apply), **when** `POST /users/me/import/:jobId/apply`, **then** worker insere rows idempotent: Favorite via `(userId, productId)`, ShoppingList via `(userId, name)`, Alert via `(userId, productId, type)`, Review via `(userId, productId)`; Receipt dedupe fuzzy `(userId, purchaseDate ±1h, total ±€0.01)`.
3. **Given** zip malformado (não é zip, ou faltam CSVs obrigatórios, ou header inválido), **when** `POST /users/me/import`, **then** 400 `IMPORT.MALFORMED_ZIP` (parse síncrono no controller) OU status=failed com `errorMessage` populado se detecta tarde no worker.
4. **Given** user já fez import nos últimos 60min, **when** novo `POST /users/me/import`, **then** 429 `RATE_LIMITED`.
5. **Given** CSV com linhas válidas misturadas a duplicatas, **when** apply, **then** summary.added conta só os NEW + summary.skipped conta os existentes (não dispara erro).
