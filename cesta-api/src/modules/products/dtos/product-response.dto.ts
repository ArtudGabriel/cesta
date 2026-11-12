import { ApiProperty } from '@nestjs/swagger';
import {
  MeasureUnit,
  Product,
  ProductPrice,
  Supermarket,
} from '@prisma/client';
import {
  UnitPrice,
  UnitPriceSuffix,
  calculateUnitPrice,
} from '../../../common/utils/price-normalization';
import {
  NutriGrade,
  calculateNutriScore,
} from '../../../common/utils/nutri-score';

export class NutriScoreDto {
  @ApiProperty({ example: -2 }) score: number;
  @ApiProperty({ example: 'A', enum: ['A', 'B', 'C', 'D', 'E'] })
  grade: NutriGrade;
}

export class UnitPriceDto {
  @ApiProperty({ example: 4.2 }) value: number;
  @ApiProperty({ example: 'L', enum: ['L', 'kg', '100g', '100ml', 'un'] })
  unit: UnitPriceSuffix;
}

export class PriceByMarketDto {
  @ApiProperty() supermarketId: string;
  @ApiProperty() supermarketSlug: string;
  @ApiProperty() supermarketName: string;
  @ApiProperty({ nullable: true }) supermarketColor: string | null;
  @ApiProperty({ example: 1.99 }) price: number;
  @ApiProperty({ type: () => UnitPriceDto, nullable: true })
  unitPrice: UnitPrice | null;
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
  @ApiProperty({ nullable: true }) saturatedFat: number | null;
  @ApiProperty({ nullable: true }) carbs: number | null;
  @ApiProperty({ nullable: true }) sugar: number | null;
  @ApiProperty({ nullable: true }) salt: number | null;
  @ApiProperty({ nullable: true }) fiber: number | null;
  @ApiProperty({ nullable: true, description: 'Base amount (100 for per-100g/ml, 1 for per-unit)' })
  nutritionPer: number | null;

  @ApiProperty({ type: () => NutriScoreDto, nullable: true })
  nutriScore: { score: number; grade: NutriGrade } | null;

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

  @ApiProperty({ type: () => UnitPriceDto, nullable: true })
  cheapestUnitPrice: UnitPrice | null;

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
    dto.saturatedFat = product.saturatedFat ? Number(product.saturatedFat) : null;
    dto.carbs = product.carbs ? Number(product.carbs) : null;
    dto.sugar = product.sugar ? Number(product.sugar) : null;
    dto.salt = product.salt ? Number(product.salt) : null;
    dto.fiber = product.fiber ? Number(product.fiber) : null;
    dto.nutritionPer = product.nutritionPer ? Number(product.nutritionPer) : null;
    dto.nutriScore = calculateNutriScore({
      calories: dto.calories,
      sugar: dto.sugar,
      saturatedFat: dto.saturatedFat,
      salt: dto.salt,
      fiber: dto.fiber,
      protein: dto.protein,
      nutritionPer: dto.nutritionPer,
      comparisonUnit: product.comparisonUnit,
    });
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
      const cheapest = availablePrices.reduce((a, b) =>
        a.price < b.price ? a : b,
      );
      dto.cheapestSupermarketSlug = cheapest.supermarketSlug;
      dto.cheapestPrice = cheapest.price;
      dto.cheapestUnitPrice = cheapest.unitPrice;
    } else {
      dto.cheapestSupermarketSlug = null;
      dto.cheapestPrice = null;
      dto.cheapestUnitPrice = null;
    }

    return dto;
  }
}

function mapPrice(
  p: ProductPrice & { supermarket: Supermarket },
  packageSize: number,
  packageUnit: MeasureUnit,
  comparisonUnit: MeasureUnit,
): PriceByMarketDto {
  const price = Number(p.currentPrice);
  let unitPrice: UnitPrice | null;
  try {
    unitPrice = calculateUnitPrice(
      price,
      packageSize,
      packageUnit,
      comparisonUnit,
    );
  } catch {
    unitPrice = null;
  }
  return {
    supermarketId: p.supermarketId,
    supermarketSlug: p.supermarket.slug,
    supermarketName: p.supermarket.name,
    supermarketColor: p.supermarket.color,
    price,
    unitPrice,
    onPromotion: p.onPromotion,
    previousPrice: p.previousPrice ? Number(p.previousPrice) : null,
    isAvailable: p.isAvailable,
    isStale: p.isStale,
    lastSyncedAt: p.lastSyncedAt,
    confidenceScore: Number(p.confidenceScore),
  };
}
