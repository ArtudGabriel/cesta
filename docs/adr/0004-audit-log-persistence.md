# ADR-0004 — Persistência de audit log (Sprint 104)

**Status:** Accepted · **Data:** 2026-11-18

## Contexto

Sprints 90–102 introduziram eventos auditáveis (UserReactivated, UserDataExported, SecretRotated, AdminCancelledDelete, UserReminderSent, TwoFactorEnabled/Disabled, UserDataImported) emitidos exclusivamente como log statements com prefixo `[audit]` em stdout. Render free tier não retém logs além de ~24h; Sentry breadcrumbs são por-request, não consultáveis em bulk; nenhum dashboard operacional para admin revisar histórico GDPR (Art. 15 — right of access, Art. 30 — records of processing).

Sprint 104 precisa de uma UI admin pra consultar esses eventos sob demanda (ex: user reclama "quando foi exportado meu ZIP?", admin precisa responder; auditor GDPR pede logs de reativação).

## Decisão

Criar model `AuditLog` persistente em Postgres (prisma schema), emitir linha DB simultânea ao log statement existente em cada emission point, expor via `GET /admin/audit-logs` paginado/filtrável.

### Schema

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String?  @map("user_id")   // sujeito (nullable: eventos de sistema)
  actorId   String?  @map("actor_id")  // executor (nullable quando = userId)
  type      String                     // whitelist em código
  metadata  Json?                      // payload event-specific
  createdAt DateTime @default(now()) @map("created_at")

  user  User? @relation("auditUser",  fields: [userId],  references: [id], onDelete: SetNull)
  actor User? @relation("auditActor", fields: [actorId], references: [id], onDelete: SetNull)

  @@index([type, createdAt])
  @@index([userId, createdAt])
  @@map("audit_logs")
}
```

- **SetNull cascade**: user hard-deleted (GDPR Art. 17, S64 worker) perde FK mas audit row sobrevive. Mantém auditabilidade pós-delete sem violar direito ao esquecimento — identificador sujeito vira `null`, metadata histórica preservada só com campos não-PII (bytes, kinds, jobId).
- **`type` como String + whitelist em código** (não enum Prisma): adicionar evento novo = 0 migrations, só patch na whitelist do service. Trade-off: tipagem fraca em DB; mitigado por Zod no boundary.
- **Índices `(type, createdAt)` + `(userId, createdAt)`**: 2 queries dominantes (filtrar por tipo + ordenar; buscar histórico de um user). `createdAt DESC` sempre.

### Emission pattern

Centralizar em `AuditService.record(type, { userId?, actorId?, metadata? })`. Chamar alongside log statement existente — não remover log (dupla fonte, debug vs. audit). Falha de DB não bloqueia fluxo principal: `try/catch` log+swallow (audit é observabilidade, não transaction-critical).

### Alternativas rejeitadas

- **Enviar pra Sentry**: Sentry breadcrumbs não são consultáveis em bulk via UI própria; exportar dashboard custom = custo + vendor-lock.
- **Logs estruturados → Loki/Grafana**: infra extra; Render free não suporta sidecar agent; adiciona dependência operacional.
- **Enum Prisma pro `type`**: toda sprint adicionando evento novo gera migration; fricção desnecessária.
- **Não persistir, só retenção estendida de logs**: Render não oferece; migrar provider = outra decisão.

## Consequências

- **Positivas**: UI admin audit funcional (/admin/audit); GDPR Art. 15 responde em segundos; retention indefinido (até decision S105+ sobre cleanup).
- **Negativas**: cresce `audit_logs` linearmente — adicionar cleanup/retention policy em sprint futura (ex: hard delete rows > 2 anos); backfill S104 reemite só a partir do deploy (histórico pré-S104 fica só em log).
- **Neutras**: duplicação write (log + DB) é intencional durante transição; sprint futura pode remover `[audit]` log se operacional confiar em DB.

## Relaciona

- ADR-0003 CSV Import (S102) — UserDataImported emite via `imports.processor.ts`
- Sprint 91 ZIP export GDPR Art. 20 — UserDataExported
- Sprint 92 JWT rotation — SecretRotated
- Sprint 94 grace-period reminders — UserReminderSent
- Sprint 99 2FA TOTP — TwoFactorEnabled/Disabled
