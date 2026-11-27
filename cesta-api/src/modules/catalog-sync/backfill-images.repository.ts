import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface BackfillCandidate {
  id: string;
  name: string;
  ean: string | null;
  sourceImageUrl: string | null;
}

export interface BackfillProductSnapshot {
  id: string;
  imageUrl: string | null;
  deletedAt: Date | null;
}

@Injectable()
export class BackfillImagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Sprint 224 (MVP Bloco 2): prioriza produtos com sourceImageUrl non-null
  // (adapters recentes Eroski/Froiz → scan resolve sem OFF). Produtos sem
  // sourceImageUrl E com EAN seguem path OFF fallback.
  findCandidates(limit: number): Promise<BackfillCandidate[]> {
    return this.prisma.product.findMany({
      where: { imageUrl: null, deletedAt: null },
      select: { id: true, name: true, ean: true, sourceImageUrl: true },
      take: limit,
      orderBy: [{ sourceImageUrl: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
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
