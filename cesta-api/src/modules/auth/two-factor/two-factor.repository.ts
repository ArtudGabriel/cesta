import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class TwoFactorRepository {
  constructor(private readonly prisma: PrismaService) {}

  setPendingSecret(userId: string, encryptedSecret: string): Promise<void> {
    return this.prisma.user
      .update({
        where: { id: userId },
        data: {
          twoFactorSecret: encryptedSecret,
          twoFactorEnabled: false,
          twoFactorBackupCodes: [],
        },
      })
      .then(() => undefined);
  }

  enable(userId: string, hashedBackupCodes: string[]): Promise<void> {
    return this.prisma.user
      .update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorBackupCodes: hashedBackupCodes,
        },
      })
      .then(() => undefined);
  }

  disable(userId: string): Promise<void> {
    return this.prisma.user
      .update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
        },
      })
      .then(() => undefined);
  }

  consumeBackupCode(
    userId: string,
    remainingHashes: string[],
  ): Promise<void> {
    return this.prisma.user
      .update({
        where: { id: userId },
        data: { twoFactorBackupCodes: remainingHashes },
      })
      .then(() => undefined);
  }
}
