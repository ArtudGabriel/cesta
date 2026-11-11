import { Injectable } from '@nestjs/common';
import {
  FamilyBasket,
  FamilyBasketItem,
  Prisma,
  Product,
  ProductPrice,
  Supermarket,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type BasketWithItems = FamilyBasket & {
  items: (FamilyBasketItem & {
    product: Product & {
      prices: (ProductPrice & { supermarket: Supermarket })[];
    };
  })[];
};

const BASKET_INCLUDE = {
  items: {
    orderBy: { position: 'asc' as const },
    include: {
      product: {
        include: {
          prices: {
            include: { supermarket: true },
            where: { supermarket: { isActive: true } },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class FamilyBasketsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIdForUser(
    id: string,
    userId: string,
  ): Promise<BasketWithItems | null> {
    return this.prisma.familyBasket.findFirst({
      where: { id, userId, deletedAt: null },
      include: BASKET_INCLUDE,
    });
  }

  findLatestByUser(userId: string): Promise<BasketWithItems | null> {
    return this.prisma.familyBasket.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { generatedAt: 'desc' },
      include: BASKET_INCLUDE,
    });
  }

  createEmpty(
    userId: string,
    familyProfileId: string,
  ): Promise<FamilyBasket> {
    return this.prisma.familyBasket.create({
      data: { userId, familyProfileId, status: 'pending' },
    });
  }

  updateStatus(
    id: string,
    status: 'pending' | 'ready' | 'failed',
    errorMessage?: string | null,
  ): Promise<FamilyBasket> {
    return this.prisma.familyBasket.update({
      where: { id },
      data: { status, errorMessage: errorMessage ?? null },
    });
  }

  async replaceItems(
    basketId: string,
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      isRequired: boolean;
      isLocked: boolean;
      position: number;
    }>,
    estimatedCost: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.familyBasketItem.deleteMany({ where: { basketId } });
      if (items.length > 0) {
        await tx.familyBasketItem.createMany({
          data: items.map((i) => ({
            basketId,
            productId: i.productId,
            quantity: new Prisma.Decimal(i.quantity),
            unitPrice: new Prisma.Decimal(i.unitPrice),
            isRequired: i.isRequired,
            isLocked: i.isLocked,
            position: i.position,
          })),
        });
      }
      await tx.familyBasket.update({
        where: { id: basketId },
        data: {
          estimatedCost: new Prisma.Decimal(estimatedCost),
          status: 'ready',
        },
      });
    });
  }

  async addOrUpdateItem(
    basketId: string,
    productId: string,
    quantity: number,
    unitPrice: number,
    opts?: { isRequired?: boolean; isLocked?: boolean; position?: number },
  ): Promise<FamilyBasketItem> {
    const position =
      opts?.position ??
      ((await this.prisma.familyBasketItem.count({
        where: { basketId },
      })) + 1);

    const item = await this.prisma.familyBasketItem.upsert({
      where: { basketId_productId: { basketId, productId } },
      create: {
        basketId,
        productId,
        quantity: new Prisma.Decimal(quantity),
        unitPrice: new Prisma.Decimal(unitPrice),
        isRequired: opts?.isRequired ?? false,
        isLocked: opts?.isLocked ?? false,
        position,
      },
      update: {
        quantity: new Prisma.Decimal(quantity),
        unitPrice: new Prisma.Decimal(unitPrice),
        isRequired: opts?.isRequired,
        isLocked: opts?.isLocked,
      },
    });
    await this.recomputeEstimatedCost(basketId);
    return item;
  }

  async updateItem(
    itemId: string,
    data: Partial<{
      quantity: number;
      isRequired: boolean;
      isLocked: boolean;
    }>,
  ): Promise<FamilyBasketItem> {
    const prismaData: Prisma.FamilyBasketItemUpdateInput = {};
    if (data.quantity !== undefined)
      prismaData.quantity = new Prisma.Decimal(data.quantity);
    if (data.isRequired !== undefined) prismaData.isRequired = data.isRequired;
    if (data.isLocked !== undefined) prismaData.isLocked = data.isLocked;

    const item = await this.prisma.familyBasketItem.update({
      where: { id: itemId },
      data: prismaData,
    });
    await this.recomputeEstimatedCost(item.basketId);
    return item;
  }

  async removeItem(itemId: string): Promise<void> {
    const item = await this.prisma.familyBasketItem.delete({
      where: { id: itemId },
    });
    await this.recomputeEstimatedCost(item.basketId);
  }

  findItemForUser(
    itemId: string,
    userId: string,
  ): Promise<FamilyBasketItem | null> {
    return this.prisma.familyBasketItem.findFirst({
      where: { id: itemId, basket: { userId, deletedAt: null } },
    });
  }

  private async recomputeEstimatedCost(basketId: string): Promise<void> {
    const items = await this.prisma.familyBasketItem.findMany({
      where: { basketId },
    });
    const total = items.reduce(
      (sum, item) =>
        sum + Number(item.unitPrice) * Number(item.quantity),
      0,
    );
    await this.prisma.familyBasket.update({
      where: { id: basketId },
      data: { estimatedCost: new Prisma.Decimal(Math.round(total * 100) / 100) },
    });
  }
}
