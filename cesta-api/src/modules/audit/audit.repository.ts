import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/**
 * Sprint 104: single owner das queries Prisma de audit_logs. Padrão
 * repository obrigatório (regra #6 CLAUDE.md — services nunca tocam
 * `this.prisma.*`). Insert tolera tipo loose em `data` pra evitar depender
 * do `Prisma.AuditLogCreateInput` nos callers (ainda damos cobertura total
 * via whitelist de types no service).
 */
@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    type: string;
    userId: string | null;
    actorId: string | null;
    metadata: unknown;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        type: data.type,
        userId: data.userId,
        actorId: data.actorId,
        metadata: (data.metadata ?? null) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
      },
    });
  }

  async listAndCount(
    where: Prisma.AuditLogWhereInput,
    limit: number,
    offset: number,
  ): Promise<{
    items: Array<{
      id: string;
      userId: string | null;
      actorId: string | null;
      type: string;
      metadata: unknown;
      createdAt: Date;
    }>;
    total: number;
  }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          userId: true,
          actorId: true,
          type: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
