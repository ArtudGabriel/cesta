/**
 * Sprint 104: shared enum / types sem dependência server-only. Client
 * components (filter, card) importam daqui pra não arrastar
 * `next/headers` do admin.server.ts via grafo.
 */
export const AUDIT_LOG_TYPES = [
  "UserReactivated",
  "UserDataExported",
  "SecretRotated",
  "AdminCancelledDelete",
  "TwoFactorEnabled",
  "TwoFactorDisabled",
  "UserDataImported",
  "UserReminderSent",
] as const;

export type AuditLogType = (typeof AUDIT_LOG_TYPES)[number];

export interface AuditLogItem {
  id: string;
  userId: string | null;
  actorId: string | null;
  type: AuditLogType;
  metadata: unknown;
  createdAt: string;
}

export interface AuditLogsPage {
  items: AuditLogItem[];
  total: number;
}
