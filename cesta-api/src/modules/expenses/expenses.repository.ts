import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface AggregateTotal {
  sum: number;
  count: number;
}

export interface CategoryItem {
  total: number;
  categoryName: string | null;
}

export interface ReceiptMarket {
  total: number;
  marketName: string | null;
  marketSlug: string | null;
}

@Injectable()
export class ExpensesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async aggregateReceiptTotals(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<AggregateTotal> {
    const result = await this.prisma.receipt.aggregate({
      where: {
        userId,
        deletedAt: null,
        status: 'ready',
        purchaseDate: { gte: from, lte: to },
      },
      _sum: { total: true },
      _count: true,
    });
    return {
      sum: Number(result._sum.total ?? 0),
      count: result._count,
    };
  }

  async findItemsForCategoryBreakdown(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<CategoryItem[]> {
    const items = await this.prisma.receiptItem.findMany({
      where: {
        receipt: {
          userId,
          deletedAt: null,
          status: 'ready',
          purchaseDate: { gte: from, lte: to },
        },
      },
      include: {
        product: { include: { category: true } },
      },
    });
    return items.map((item) => ({
      total: Number(item.total),
      categoryName: item.product?.category?.nameEs ?? null,
    }));
  }

  async findReceiptsForMarketBreakdown(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<ReceiptMarket[]> {
    const receipts = await this.prisma.receipt.findMany({
      where: {
        userId,
        deletedAt: null,
        status: 'ready',
        purchaseDate: { gte: from, lte: to },
      },
      include: { supermarket: true },
    });
    return receipts.map((r) => ({
      total: Number(r.total ?? 0),
      marketName: r.supermarket?.name ?? null,
      marketSlug: r.supermarketSlug ?? null,
    }));
  }
}
