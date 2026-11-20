import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface BackfillCandidate {
  id: string;
  name: string;
  ean: string | null;
}

export interface BackfillProductSnapshot {
  id: string;
  imageUrl: string | null;
  deletedAt: Date | null;
}

@Injectable()
export class BackfillImagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCandidates(limit: number): Promise<BackfillCandidate[]> {
    return this.prisma.product.findMany({
      where: { imageUrl: null, deletedAt: null },
      select: { id: true, name: true, ean: true },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }

  findSnapshot(productId: string): Promise<BackfillProductSnapshot | null> {
    return this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, imageUrl: true, deletedAt: true },
    });
  }

  async updateImageUrl(productId: string, imageUrl: string): Promise<void> {
    await this.prisma.product.update({
      where: { id: productId },
      data: { imageUrl },
    });
  }
}
