import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { phone, deletedAt: null } });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...data,
        email: data.email ? data.email.toLowerCase() : null,
      },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Sprint 64: lookup ignorando deletedAt filter — worker user-cleanup
   * precisa ver users soft-deleted pra validar grace period.
   */
  async findByIdIgnoreDeleted(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Sprint 64: hard-delete GDPR Art.17 pós grace period. Cascade FK apaga
   * as 11 relações User em uma transação implícita Prisma.
   */
  async hardDelete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  /**
   * Sprint 63 GDPR Art. 20 (data portability). Agrega todas as entidades
   * per-user num único payload de export. Cross-feature por natureza; DSR
   * fica contido no users module (não espalha repos em services).
   */
  async exportUserData(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        favorites: {
          include: {
            product: { select: { id: true, name: true, brand: true } },
          },
        },
        shoppingLists: {
          where: { deletedAt: null },
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true } },
              },
            },
          },
        },
        reviews: {
          where: { deletedAt: null },
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        alerts: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        receipts: {
          where: { deletedAt: null },
          include: {
            items: true,
          },
        },
        familyProfile: true,
        familyBaskets: {
          where: { deletedAt: null },
          include: {
            items: true,
          },
        },
        searchHistory: true,
      },
    });
  }

  /**
   * Sprint 63 GDPR Art. 17 (right to be forgotten). Transaction:
   * soft-delete user + revoga refresh tokens + zera consent (user não existe
   * mais, não pode manter tracking consent).
   */
  async softDeleteWithRevoke(id: string): Promise<User> {
    // Sprint 64: além do soft-delete + token revoke, agenda hard-delete
    // em 30d via hardDeleteScheduledAt. Worker user-cleanup processa.
    return this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const now = new Date();
      const scheduledFor = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000,
      );
      return tx.user.update({
        where: { id },
        data: {
          deletedAt: now,
          hardDeleteScheduledAt: scheduledFor,
          cookieConsentLevel: null,
          cookiesAcceptedAt: null,
        },
      });
    });
  }
}
