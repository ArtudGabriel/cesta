import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Product,
  ProductPrice,
  ShoppingList,
  ShoppingListItem,
  Supermarket,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type ItemWithProduct = ShoppingListItem & {
  product: Product & {
    prices: (ProductPrice & { supermarket: Supermarket })[];
  };
};

export type ListWithItems = ShoppingList & { items: ItemWithProduct[] };

const ITEM_INCLUDE = {
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
export class ShoppingListsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUser(userId: string): Promise<ListWithItems[]> {
    return this.prisma.shoppingList.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: ITEM_INCLUDE,
    });
  }

  findByIdForUser(
    id: string,
    userId: string,
  ): Promise<ListWithItems | null> {
    return this.prisma.shoppingList.findFirst({
      where: { id, userId, deletedAt: null },
      include: ITEM_INCLUDE,
    });
  }

  create(userId: string, name: string): Promise<ListWithItems> {
    return this.prisma.shoppingList.create({
      data: { userId, name },
      include: ITEM_INCLUDE,
    });
  }

  updateName(id: string, name: string): Promise<ShoppingList> {
    return this.prisma.shoppingList.update({ where: { id }, data: { name } });
  }

  softDelete(id: string): Promise<ShoppingList> {
    return this.prisma.shoppingList.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async addItem(
    listId: string,
    productId: string,
    quantity: number,
    position?: number,
  ): Promise<void> {
    const pos =
      position ??
      ((await this.prisma.shoppingListItem.count({ where: { listId } })) + 1);

    await this.prisma.shoppingListItem.upsert({
      where: { listId_productId: { listId, productId } },
      create: {
        listId,
        productId,
        quantity: new Prisma.Decimal(quantity),
        position: pos,
      },
      update: { quantity: new Prisma.Decimal(quantity) },
    });

    await this.touchList(listId);
  }

  async updateItemQuantity(
    itemId: string,
    quantity: number,
  ): Promise<ShoppingListItem> {
    const item = await this.prisma.shoppingListItem.update({
      where: { id: itemId },
      data: { quantity: new Prisma.Decimal(quantity) },
    });
    await this.touchList(item.listId);
    return item;
  }

  async removeItem(itemId: string): Promise<void> {
    const item = await this.prisma.shoppingListItem.delete({
      where: { id: itemId },
    });
    await this.touchList(item.listId);
  }

  findItemForUser(
    itemId: string,
    userId: string,
  ): Promise<ShoppingListItem | null> {
    return this.prisma.shoppingListItem.findFirst({
      where: { id: itemId, list: { userId, deletedAt: null } },
    });
  }

  async duplicate(sourceList: ListWithItems): Promise<ListWithItems> {
    const created = await this.prisma.shoppingList.create({
      data: {
        userId: sourceList.userId,
        name: `${sourceList.name} (copia)`,
        items: {
          create: sourceList.items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            position: it.position,
          })),
        },
      },
      include: ITEM_INCLUDE,
    });
    return created;
  }

  private touchList(listId: string): Promise<ShoppingList> {
    return this.prisma.shoppingList.update({
      where: { id: listId },
      data: { updatedAt: new Date() },
    });
  }
}
