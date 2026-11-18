# ADR-0005 — Alert Rules (combo/trend/bundle) via AlertRule model (Sprint 105)

**Status:** Accepted · **Data:** 2026-11-18

## Contexto

Sprint 60 criou `Alert` (type = `promotion | target_price | promotion_ending | back_in_stock`) para o cenário "monitorar 1 produto em até 1 mercado". Sprint 96 fechou o loop com push notifications idempotent via cron 2h (`alert-price-check`).

Sprint 105 amplia o produto com 3 regras compostas pedidas no roadmap de monetização premium:

- **combo** — usuário quer montar "café da manhã por até €10" (vários produtos, qualquer mercado, soma total ≤ target)
- **trend** — "quando o preço do Café Lavazza cair 2+ semanas seguidas, me avise" (série temporal)
- **bundle** — "qual mercado tem a cesta mais barata? me avise se der pra economizar ≥ €5" (comparativo multi-mercado)

O model `Alert` legado assume 1 `productId` NOT NULL + 1 `supermarketId?` e campos escalares (`targetPrice Decimal?`). Forçar as novas regras nessa estrutura exigiria tornar `productId` nullable (quebra S60/S96) e empilhar flags opcionais.

## Decisão

Criar **model `AlertRule` novo e separado** do `Alert` legado, com payload polimórfico em `rules Json`:

```prisma
model AlertRule {
  id              String    @id @default(cuid())
  userId          String    @map("user_id")
  type            String    // "combo" | "trend" | "bundle" — whitelist código
  rules           Json      // shape depende do type (validado por Zod no boundary)
  isActive        Boolean   @default(true) @map("is_active")

  // idempotência push (mesmo pattern S96): só reenfileira quando hash do
  // estado avaliado mudou vs último disparo
  lastNotifiedAt   DateTime? @map("last_notified_at")
  lastNotifiedHash String?   @map("last_notified_hash")

  lastTriggeredAt  DateTime? @map("last_triggered_at")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isActive, deletedAt])
  @@index([type, isActive, deletedAt])
  @@map("alert_rules")
}
```

### Rules payload shapes (validados Zod)

- `combo`: `{ productIds: string[2..20], targetTotal: number >=0.01 }`
- `trend`: `{ productId: string, consecutiveWeeks: integer 2..12 }`
- `bundle`: `{ productIds: string[2..20], targetSavings: number >=0.01 }`

### Evaluator — `alert-rule-evaluator` queue (BullMQ cron 2h)

- Varre `findAllActive()` agrupado por type
- `combo`: calcula menor `ProductPrice.currentPrice` por productId (across mercados), soma total, compara vs `targetTotal`
- `trend`: pega `PriceSnapshot` do produto nas últimas N+1 semanas (uma por semana, min por janela), confirma queda monotônica strict por N semanas consecutivas
- `bundle`: pra cada mercado que tem todos os productIds em estoque, soma preços; `max - min >= targetSavings` dispara
- Enfileira push via `NotificationsService.sendToUser` (reusa S96 sender)
- Idempotente via `lastNotifiedHash = sha256(JSON.stringify(stateSnapshot))`: só notifica se hash mudou vs `lastNotifiedHash`

### Trial cap + duplicate guard

- **Trial cap** (contexto monetização premium): máx 5 regras ativas (`isActive=true AND deletedAt IS NULL`) por user → 403 `ALERTS_RULES.TRIAL_CAP`. Config via `ALERT_RULES_TRIAL_CAP` env (default 5).
- **Duplicate**: hash determinístico sobre `(type, canonical(rules))` (productIds ordenados ASC, targets normalizados). Match ativo do mesmo user → 409 `ALERTS_RULES.DUPLICATE`.

### Rate limit

- Named throttler `write` (10 req / 60s) via `@Throttle({ write: { limit: 10, ttl: 60_000 } })` — alinhado ao padrão `imports.controller.ts` S102.
- `GET /alerts/rules` segue throttler default global (60/min).

## Alternativas consideradas

- **Reaproveitar `Alert` + `productId NULL`** — Rejeitado: migração destrutiva de FK + branching lógico espalhado por 2 processors + DTO híbrido com todos os campos opcionais vira lixo de nullchecks.
- **3 tables separadas (`combo_alerts`, `trend_alerts`, `bundle_alerts`)** — Rejeitado: evaluator teria que fazer 3 queries + merge; UI `/alertas` precisaria de 3 fetches. Vs 1 table + JSON payload = 1 query + 1 switch no evaluator.
- **Enum Prisma pra `type`** — Rejeitado pelo mesmo motivo de ADR-0004: adicionar regra nova no futuro vira migration vs patch no Zod/switch.

## Consequências

- **(+)** Novos tipos futuros (ex: `stock_watch`, `category_promotion`) viram 1 branch no switch + 1 Zod schema; zero migration.
- **(+)** `Alert` legado intocado → S60+S96 continuam funcionando sem risco.
- **(+)** `rules` como JSON permite admin inspection sem joins; fácil pra Sentry breadcrumb.
- **(−)** Validação forte só no boundary (Zod); DB aceita qualquer JSON. Mitigado por testes do evaluator que cobrem shape malformado (skip + log vs crash).
- **(−)** GDPR: `rules` contém `productIds` (não é PII direto, catálogo público). Mas combinação `(userId, productIds)` é padrão de consumo pessoal → tratar como quasi-PII. Frontend mascara `rules.productIds` display com `data-sentry-mask`; backend não loga `rules` em stdout fora de audit log admin.

## Fontes

- `cesta-api/openapi/alert-rules.yaml` — contract completo
- Sprint 96: idempotência push via `lastNotifiedPrice` (análogo direto do `lastNotifiedHash` aqui)
- ADR-0004 (whitelist string + Zod boundary) — mesma filosofia
