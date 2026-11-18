import { Injectable, Logger } from '@nestjs/common';
import { AuditRepository } from './audit.repository';

export const AUDIT_LOG_TYPES = [
  'UserReactivated',
  'UserDataExported',
  'SecretRotated',
  'AdminCancelledDelete',
  'TwoFactorEnabled',
  'TwoFactorDisabled',
  'UserDataImported',
  'UserReminderSent',
] as const;

export type AuditLogType = (typeof AUDIT_LOG_TYPES)[number];

export interface AuditRecordInput {
  type: AuditLogType;
  userId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditLogListResult {
  items: Array<{
    id: string;
    userId: string | null;
    actorId: string | null;
    type: string;
    metadata: unknown;
    createdAt: Date;
  }>;
  total: number;
}

/**
 * Sprint 104: ÚNICO ponto de persistência de audit log. Chamado dos pontos
 * de emissão existentes (auth.service, jwt-rotation, users.service,
 * imports.processor, two-factor.service, grace-reminder.processor) alongside
 * dos log statements `[audit] …` já existentes. Falha de DB nunca bloqueia
 * fluxo principal — audit é observabilidade. Ver ADR-0004. Persistência via
 * AuditRepository (regra #6: zero prisma direto no service).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repo: AuditRepository) {}

  async record(input: AuditRecordInput): Promise<void> {
    try {
      await this.repo.create({
        type: input.type,
        userId: input.userId ?? null,
        actorId: input.actorId ?? null,
        metadata: input.metadata ?? null,
      });
    } catch (err) {
      this.logger.error(
        `AuditService.record failed type=${input.type} userId=${input.userId ?? 'null'} err=${(err as Error).message}`,
      );
    }
  }

  async list(
    limit: number,
    offset: number,
    typesCsv?: string,
  ): Promise<AuditLogListResult> {
    const types = this.parseTypes(typesCsv);
    const where = types.length > 0 ? { type: { in: types } } : {};
    return this.repo.listAndCount(where, limit, offset);
  }

  /**
   * Parse CSV, validar contra whitelist. Lança se qualquer item fora da lista
   * — controller converte em 400. Vazio/undefined → [] (sem filtro).
   */
  parseTypes(csv?: string): AuditLogType[] {
    if (!csv) return [];
    const parts = csv
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const invalid = parts.filter(
      (p) => !(AUDIT_LOG_TYPES as readonly string[]).includes(p),
    );
    if (invalid.length > 0) {
      throw new Error(`invalid audit types: ${invalid.join(',')}`);
    }
    return parts as AuditLogType[];
  }
}
