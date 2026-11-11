import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Product,
  Receipt,
  ReceiptItem,
  Supermarket,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type ReceiptWithRelations = Receipt & {
  supermarket: Supermarket | null;
  items: (ReceiptItem & { product: Product | null })[];
};

const RECEIPT_INCLUDE = {
  supermarket: true,
  items: {
    orderBy: { position: 'asc' as const },
    include: { product: true },
  },
} as const;

@Injectable()
export class ReceiptsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    userId: string,
    imageUrl: string,
    notes?: string,
  ): Promise<Receipt> {
    return this.prisma.receipt.create({
      data: { userId, imageUrl, notes: notes ?? null, status: 'pending' },
    });
  }

  findByIdForUser(
    id: string,
    userId: string,
  ): Promise<ReceiptWithRelations | null> {
    return this.prisma.receipt.findFirst({
      where: { id, userId, deletedAt: null },
      include: RECEIPT_INCLUDE,
    });
  }

  findByIdWithItems(id: string): Promise<ReceiptWithRelations | null> {
    return this.prisma.receipt.findFirst({
      where: { id, deletedAt: null },
      include: RECEIPT_INCLUDE,
    });
  }

  findAllByUser(userId: string): Promise<ReceiptWithRelations[]> {
    return this.prisma.receipt.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: RECEIPT_INCLUDE,
    });
  }

  updateStatus(
    id: string,
    status: 'pending' | 'processing' | 'ready' | 'failed',
    errorMessage?: string | null,
  ): Promise<Receipt> {
    return this.prisma.receipt.update({
      where: { id },
      data: { status, errorMessage: errorMessage ?? null },
    });
  }

  updateParsed(
    id: string,
    data: {
      supermarketId?: string | null;
      supermarketSlug?: string | null;
      purchaseDate?: Date | null;
      total?: number | null;
      ocrRawText?: string | null;
    },
  ): Promise<Receipt> {
    return this.prisma.receipt.update({
      where: { id },
      data: {
        supermarketId: data.supermarketId,
        supermarketSlug: data.supermarketSlug,
        purchaseDate: data.purchaseDate,
        total:
          data.total != null ? new Prisma.Decimal(data.total) : undefined,
        ocrRawText: data.ocrRawText,
      },
    });
  }

  async replaceItems(
    receiptId: string,
    items: Array<{
      rawText: string;
      normalizedName: string;
      quantity: number;
      unitPrice: number;
      total: number;
      productId: string | null;
      categoryHint: string | null;
    }>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.receiptItem.deleteMany({ where: { receiptId } });
      if (items.length > 0) {
        await tx.receiptItem.createMany({
          data: items.map((item, index) => ({
            receiptId,
            rawText: item.rawText,
            normalizedName: item.normalizedName,
            quantity: new Prisma.Decimal(item.quantity),
            unitPrice: new Prisma.Decimal(item.unitPrice),
            total: new Prisma.Decimal(item.total),
            productId: item.productId,
            categoryHint: item.categoryHint,
            position: index,
          })),
        });
      }
    });
  }

  updateItem(
    itemId: string,
    data: { quantity?: number; unitPrice?: number; productId?: string | null },
  ): Promise<ReceiptItem> {
    const update: Prisma.ReceiptItemUpdateInput = {};
    if (data.quantity !== undefined)
      update.quantity = new Prisma.Decimal(data.quantity);
    if (data.unitPrice !== undefined)
      update.unitPrice = new Prisma.Decimal(data.unitPrice);
    if (data.productId !== undefined) {
      update.product = data.productId
        ? { connect: { id: data.productId } }
        : { disconnect: true };
    }
    return this.prisma.receiptItem.update({
      where: { id: itemId },
      data: update,
    });
  }

  findItemForUser(itemId: string, userId: string) {
    return this.prisma.receiptItem.findFirst({
      where: {
        id: itemId,
        receipt: { userId, deletedAt: null },
      },
    });
  }

  updateMeta(
    id: string,
    data: { supermarketSlug?: string; notes?: string },
  ): Promise<Receipt> {
    const update: Prisma.ReceiptUpdateInput = {};
    if (data.supermarketSlug !== undefined) {
      update.supermarket = data.supermarketSlug
        ? { connect: { slug: data.supermarketSlug } }
        : { disconnect: true };
      update.supermarketSlug = data.supermarketSlug;
    }
    if (data.notes !== undefined) update.notes = data.notes;
    return this.prisma.receipt.update({ where: { id }, data: update });
  }

  softDelete(id: string): Promise<Receipt> {
    return this.prisma.receipt.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
