import { ApiProperty } from '@nestjs/swagger';
import {
  Product,
  ProductPrice,
  ShoppingList,
  ShoppingListItem,
  Supermarket,
} from '@prisma/client';
import {
  PriceByMarketDto,
  ProductResponseDto,
} from '../../products/dtos/product-response.dto';

export class ListItemDto {
  @ApiProperty() id: string;
  @ApiProperty() productId: string;
  @ApiProperty() quantity: number;
  @ApiProperty() position: number;
  @ApiProperty() product: ProductResponseDto;
}

export class ShoppingListResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() itemCount: number;
  @ApiProperty({ nullable: true }) cheapestTotal: number | null;
  @ApiProperty({ nullable: true }) cheapestSupermarketSlug: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ type: [ListItemDto], required: false })
  items?: ListItemDto[];

  static fromEntity(
    list: ShoppingList & {
      items?: (ShoppingListItem & {
        product: Product & {
          prices: (ProductPrice & { supermarket: Supermarket })[];
        };
      })[];
    },
  ): ShoppingListResponseDto {
    const dto = new ShoppingListResponseDto();
    dto.id = list.id;
    dto.name = list.name;
    dto.createdAt = list.createdAt;
    dto.updatedAt = list.updatedAt;
    dto.itemCount = list.items?.length ?? 0;

    if (list.items) {
      dto.items = list.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: Number(item.quantity),
        position: item.position,
        product: ProductResponseDto.fromEntity(item.product),
      }));

      const totals = calcTotalsBySupermarket(dto.items);
      const cheapest = totals
        .filter((t) => t.missingItems === 0)
        .sort((a, b) => a.total - b.total)[0];
      if (cheapest) {
        dto.cheapestTotal = cheapest.total;
        dto.cheapestSupermarketSlug = cheapest.supermarketSlug;
      } else {
        dto.cheapestTotal = null;
        dto.cheapestSupermarketSlug = null;
      }
    } else {
      dto.cheapestTotal = null;
      dto.cheapestSupermarketSlug = null;
    }

    return dto;
  }
}

export interface SupermarketTotal {
  supermarketId: string;
  supermarketSlug: string;
  supermarketName: string;
  supermarketColor: string | null;
  total: number;
  availableItems: number;
  missingItems: number;
  itemsBreakdown: Array<{
    productId: string;
    quantity: number;
    unitPrice: number | null;
    subtotal: number | null;
    onPromotion: boolean;
    isAvailable: boolean;
  }>;
}

export function calcTotalsBySupermarket(
  items: ListItemDto[],
): SupermarketTotal[] {
  const bySlug = new Map<string, SupermarketTotal>();

  for (const item of items) {
    for (const price of item.product.prices) {
      const existing = bySlug.get(price.supermarketSlug) ?? {
        supermarketId: price.supermarketId,
        supermarketSlug: price.supermarketSlug,
        supermarketName: price.supermarketName,
        supermarketColor: price.supermarketColor,
        total: 0,
        availableItems: 0,
        missingItems: 0,
        itemsBreakdown: [],
      };

      const isAvailable = price.isAvailable;
      const subtotal = isAvailable ? round2(price.price * item.quantity) : null;

      existing.itemsBreakdown.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: isAvailable ? price.price : null,
        subtotal,
        onPromotion: price.onPromotion,
        isAvailable,
      });

      if (isAvailable && subtotal !== null) {
        existing.total = round2(existing.total + subtotal);
        existing.availableItems += 1;
      } else {
        existing.missingItems += 1;
      }

      bySlug.set(price.supermarketSlug, existing);
    }
  }

  return [...bySlug.values()];
}

export class HybridItemDto {
  @ApiProperty() productId: string;
  @ApiProperty() productName: string;
  @ApiProperty() quantity: number;
  @ApiProperty() supermarketSlug: string;
  @ApiProperty() supermarketName: string;
  @ApiProperty({ nullable: true }) supermarketColor: string | null;
  @ApiProperty() unitPrice: number;
  @ApiProperty() subtotal: number;
  @ApiProperty() onPromotion: boolean;
}

export class ListTotalsDto {
  @ApiProperty({ type: [Object] })
  bySupermarket: SupermarketTotal[];

  @ApiProperty({ nullable: true }) cheapestSupermarketSlug: string | null;
  @ApiProperty({ nullable: true }) cheapestTotal: number | null;
  @ApiProperty({ nullable: true }) mostExpensiveTotal: number | null;
  @ApiProperty({
    description: 'Economia vs mercado mais caro (comparando totais completos)',
  })
  savingsVsMostExpensive: number;

  @ApiProperty({ type: [HybridItemDto] })
  hybridItems: HybridItemDto[];

  @ApiProperty() hybridTotal: number;
  @ApiProperty({ description: 'Economia da lista híbrida vs mercado mais barato' })
  hybridSavings: number;

  @ApiProperty() generatedAt: Date;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
