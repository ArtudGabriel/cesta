import { ApiProperty } from '@nestjs/swagger';
import {
  MeasureUnit,
  Product,
  ProductPrice,
  Supermarket,
} from '@prisma/client';

export class PriceByMarketDto {
  @ApiProperty() supermarketId: string;
  @ApiProperty() supermarketSlug: string;
  @ApiProperty() supermarketName: string;
  @ApiProperty({ nullable: true }) supermarketColor: string | null;
  @ApiProperty({ example: 1.99 }) price: number;
  @ApiProperty({ example: 1.33, description: 'Preço por unidade padronizada' })
  pricePerUnit: number;
  @ApiProperty({ example: 'per 1L' }) pricePerUnitLabel: string;
  @ApiProperty() onPromotion: boolean;
  @ApiProperty({ nullable: true }) previousPrice: number | null;
  @ApiProperty() isAvailable: boolean;
  @ApiProperty() isStale: boolean;
  @ApiProperty() lastSyncedAt: Date;
  @ApiProperty({ example: 1.0 }) confidenceScore: number;
}

export class ProductResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) brand: string | null;
  @ApiProperty({ nullable: true }) imageUrl: string | null;
  @ApiProperty({ nullable: true }) categoryId: string | null;
  @ApiProperty() packageSize: number;
  @ApiProperty({ enum: Object.values(MeasureUnit) }) packageUnit: string;
  @ApiProperty({ enum: Object.values(MeasureUnit) }) comparisonUnit: string;

  // Nutrição
  @ApiProperty({ nullable: true }) calories: number | null;
  @ApiProperty({ nullable: true }) protein: number | null;
  @ApiProperty({ nullable: true }) fat: number | null;
  @ApiProperty({ nullable: true }) carbs: number | null;
  @ApiProperty({ nullable: true }) sugar: number | null;
  @ApiProperty({ nullable: true }) salt: number | null;
  @ApiProperty({ nullable: true }) fiber: number | null;

  // Tags
  @ApiProperty() isVegan: boolean;
  @ApiProperty() isVegetarian: boolean;
  @ApiProperty() isGlutenFree: boolean;
  @ApiProperty() isLactoseFree: boolean;

  // Preços
  @ApiProperty({ type: [PriceByMarketDto] })
  prices: PriceByMarketDto[];

  @ApiProperty({ nullable: true })
  cheapestSupermarketSlug: string | null;

  @ApiProperty({ nullable: true })
  cheapestPrice: number | null;

  static fromEntity(
    product: Product & {
      prices?: (ProductPrice & { supermarket: Supermarket })[];
    },
  ): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = product.id;
    dto.name = product.name;
    dto.brand = product.brand;
    dto.imageUrl = product.imageUrl;
    dto.categoryId = product.categoryId;
    dto.packageSize = Number(product.packageSize);
    dto.packageUnit = product.packageUnit;
    dto.comparisonUnit = product.comparisonUnit;
    dto.calories = product.calories ? Number(product.calories) : null;
    dto.protein = product.protein ? Number(product.protein) : null;
    dto.fat = product.fat ? Number(product.fat) : null;
    dto.carbs = product.carbs ? Number(product.carbs) : null;
    dto.sugar = product.sugar ? Number(product.sugar) : null;
    dto.salt = product.salt ? Number(product.salt) : null;
    dto.fiber = product.fiber ? Number(product.fiber) : null;
    dto.isVegan = product.isVegan;
    dto.isVegetarian = product.isVegetarian;
    dto.isGlutenFree = product.isGlutenFree;
    dto.isLactoseFree = product.isLactoseFree;

    const prices = (product.prices ?? []).map((p) =>
      mapPrice(
        p,
        Number(product.packageSize),
        product.packageUnit,
        product.comparisonUnit,
      ),
    );
    dto.prices = prices;

    const availablePrices = prices.filter((p) => p.isAvailable);
    if (availablePrices.length > 0) {
      const cheapest = availablePrices.reduce((a, b) => (a.price < b.price ? a : b));
      dto.cheapestSupermarketSlug = cheapest.supermarketSlug;
      dto.cheapestPrice = cheapest.price;
    } else {
      dto.cheapestSupermarketSlug = null;
      dto.cheapestPrice = null;
    }

    return dto;
  }
}

function mapPrice(
  p: ProductPrice & { supermarket: Supermarket },
  packageSize: number,
  packageUnit: string,
  comparisonUnit: string,
): PriceByMarketDto {
  const price = Number(p.currentPrice);
  const { pricePerUnit, label } = calcPricePerUnit(
    price,
    packageSize,
    packageUnit,
    comparisonUnit,
  );
  return {
    supermarketId: p.supermarketId,
    supermarketSlug: p.supermarket.slug,
    supermarketName: p.supermarket.name,
    supermarketColor: p.supermarket.color,
    price,
    pricePerUnit,
    pricePerUnitLabel: label,
    onPromotion: p.onPromotion,
    previousPrice: p.previousPrice ? Number(p.previousPrice) : null,
    isAvailable: p.isAvailable,
    isStale: p.isStale,
    lastSyncedAt: p.lastSyncedAt,
    confidenceScore: Number(p.confidenceScore),
  };
}

export function calcPricePerUnit(
  price: number,
  packageSize: number,
  packageUnit: string,
  comparisonUnit: string,
): { pricePerUnit: number; label: string } {
  // Normaliza embalagem para unidade base (L, kg, un) e depois escala para comparisonUnit
  let baseSize = packageSize;
  switch (packageUnit) {
    case 'MILLILITER':
      baseSize = packageSize / 1000;
      break;
    case 'GRAM':
      baseSize = packageSize / 1000;
      break;
  }

  switch (comparisonUnit) {
    case 'LITER':
      return {
        pricePerUnit: round2(price / baseSize),
        label: 'por 1L',
      };
    case 'MILLILITER':
      return {
        pricePerUnit: round2((price / baseSize) * 0.1),
        label: 'por 100ml',
      };
    case 'KILOGRAM':
      return {
        pricePerUnit: round2(price / baseSize),
        label: 'por 1kg',
      };
    case 'GRAM':
      return {
        pricePerUnit: round2((price / baseSize) * 0.1),
        label: 'por 100g',
      };
    case 'UNIT':
      return {
        pricePerUnit: round2(price / packageSize),
        label: 'por unidad',
      };
    default:
      return { pricePerUnit: price, label: '' };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
