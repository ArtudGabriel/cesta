import { Injectable } from '@nestjs/common';
import { Import, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ImportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    userId: string;
    zipPath: string;
    dryRun: boolean;
  }): Promise<Import> {
    return this.prisma.import.create({
      data: {
        userId: data.userId,
        zipPath: data.zipPath,
        dryRun: data.dryRun,
        status: 'pending',
      },
    });
  }

  findByIdForUser(id: string, userId: string): Promise<Import | null> {
    return this.prisma.import.findFirst({ where: { id, userId } });
  }

  updateStatus(
    id: string,
    status: string,
    extra: { summary?: unknown; errorMessage?: string | null } = {},
  ): Promise<Import> {
    const data: Prisma.ImportUpdateInput = { status };
    if (extra.summary !== undefined) {
      data.summary = extra.summary as Prisma.InputJsonValue;
    }
    if (extra.errorMessage !== undefined) {
      data.errorMessage = extra.errorMessage;
    }
    return this.prisma.import.update({ where: { id }, data });
  }

  clearZipPath(id: string): Promise<Import> {
    return this.prisma.import.update({
      where: { id },
      data: { zipPath: null },
    });
  }
}
