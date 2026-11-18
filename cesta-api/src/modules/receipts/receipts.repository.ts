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

  async updateItemAndRecalc(
    receiptId: string,
    itemId: string,
    data: { quantity?: number; unitPrice?: number; productId?: string | null },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.receiptItem.findUnique({
        where: { id: itemId },
        select: { quantity: true, unitPrice: true },
      });
      if (!current) return;
      const update: Prisma.ReceiptItemUpdateInput = {};
      const nextQty =
        data.quantity !== undefined ? data.quantity : Number(current.quantity);
      const nextUnit =
        data.unitPrice !== undefined
          ? data.unitPrice
          : Number(current.unitPrice);
      if (data.quantity !== undefined)
        update.quantity = new Prisma.Decimal(data.quantity);
      if (data.unitPrice !== undefined)
        update.unitPrice = new Prisma.Decimal(data.unitPrice);
      if (data.quantity !== undefined || data.unitPrice !== undefined) {
        update.total = new Prisma.Decimal(round2(nextQty * nextUnit));
      }
      if (data.productId !== undefined) {
        update.product = data.productId
          ? { connect: { id: data.productId } }
          : { disconnect: true };
      }
      await tx.receiptItem.update({ where: { id: itemId }, data: update });
      await recalcReceiptTotal(tx, receiptId);
    });
  }

  async addItemAndRecalc(
    receiptId: string,
    data: {
      rawText: string;
      normalizedName: string;
      quantity: number;
      unitPrice: number;
      productId?: string | null;
      categoryHint?: string | null;
    },
  ): Promise<void> {
    const total = round2(data.quantity * data.unitPrice);
    await this.prisma.$transaction(async (tx) => {
      const last = await tx.receiptItem.findFirst({
        where: { receiptId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      const position = (last?.position ?? -1) + 1;
      await tx.receiptItem.create({
        data: {
          receiptId,
          rawText: data.rawText,
          normalizedName: data.normalizedName,
          quantity: new Prisma.Decimal(data.quantity),
          unitPrice: new Prisma.Decimal(data.unitPrice),
          total: new Prisma.Decimal(total),
          productId: data.productId ?? null,
          categoryHint: data.categoryHint ?? null,
          position,
        },
      });
      await recalcReceiptTotal(tx, receiptId);
    });
  }

  async removeItemAndRecalc(
    receiptId: string,
    itemId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.receiptItem.deleteMany({
        where: { id: itemId, receiptId },
      });
      await recalcReceiptTotal(tx, receiptId);
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
    data: {
      supermarketSlug?: string | null;
      purchaseDate?: Date | null;
      total?: number | null;
      notes?: string;
    },
  ): Promise<Receipt> {
    const update: Prisma.ReceiptUpdateInput = {};
    if (data.supermarketSlug !== undefined) {
      update.supermarket = data.supermarketSlug
        ? { connect: { slug: data.supermarketSlug } }
        : { disconnect: true };
      update.supermarketSlug = data.supermarketSlug;
    }
    if (data.purchaseDate !== undefined) update.purchaseDate = data.purchaseDate;
    if (data.total !== undefined)
      update.total =
        data.total === null ? null : new Prisma.Decimal(round2(data.total));
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function recalcReceiptTotal(
  tx: Prisma.TransactionClient,
  receiptId: string,
): Promise<void> {
  const agg = await tx.receiptItem.aggregate({
    where: { receiptId },
    _sum: { total: true },
  });
  await tx.receipt.update({
    where: { id: receiptId },
    data: { total: agg._sum.total ?? new Prisma.Decimal(0) },
  });
}
