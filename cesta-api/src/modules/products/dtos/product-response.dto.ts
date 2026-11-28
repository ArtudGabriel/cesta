import { ApiProperty } from '@nestjs/swagger';
import {
  Category,
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
  NutriCategory,
  NutriGrade,
  calculateNutriScore,
} from '../../../common/utils/nutri-score';

// Sprint 61: Nutri-Score oficial com variantes por categoria.
// Mapping category.slug → variant Nutri-Score. Slugs não listados caem no
// `general`. Ampliar quando catálogo adicionar novas categorias.
const NUTRI_CATEGORY_MAP: Record<string, NutriCategory> = {
  bebidas: 'beverage',
  refrescos: 'beverage',
  zumos: 'beverage',
  aguas: 'beverage',
  aceites: 'fat',
  grasas: 'fat',
  mantequilla: 'fat',
  quesos: 'cheese',
};

export function resolveNutriCategory(
  categorySlug: string | null | undefined,
): NutriCategory {
  if (!categorySlug) return 'general';
  return NUTRI_CATEGORY_MAP[categorySlug] ?? 'general';
}

// Sprint 226 (ADR 0034): threshold lido no load (zero env read por request).
// Expor computeIsStale pra specs unit sem acoplar Date.now.
export function parseStaleThresholdHours(
  raw: string | number | undefined,
): number {
  if (raw === undefined || raw === null || raw === '') return 48;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 48;
}

const STALE_THRESHOLD_HOURS = parseStaleThresholdHours(
  process.env.PRICE_STALE_THRESHOLD_HOURS,
);
const STALE_THRESHOLD_MS = STALE_THRESHOLD_HOURS * 60 * 60 * 1000;

// Sprint 226 AJUSTE P1 (PR #192 Reviewer): combina os DOIS sinais de
// staleness em OR.
//
//   (a) Coluna `ProductPrice.isStale` escrita por catalog-sync:
//       `markStaleForSupermarket` flipa true pra rows que o adapter NÃO
//       tocou no run (produto delistado, miss de scrape). Sinal autoritativo
//       do adapter.
//
//   (b) `computeIsStale(lastSyncedAt)`: fallback baseado em idade do
//       timestamp (threshold env). Captura casos em que o cron NUNCA
//       completou (Froiz 12d sem run; adapter down; Render spin-down perdeu
//       janela). Nessa situação a coluna (a) fica desatualizada (last
//       successful upsert deixou isStale=false) e só o (b) detecta.
//
// Sem o (b), o badge não firava pra adapters que caíram entre dois ciclos
// (bug reportado 2026-11-27 Froiz 3/3 lastSyncedAt 12d, coluna false).
export function computeIsStale(
  lastSyncedAt: Date | string | null | undefined,
  nowMs: number = Date.now(),
  thresholdMs: number = STALE_THRESHOLD_MS,
): boolean {
  if (!lastSyncedAt) return true;
  const ts =
    lastSyncedAt instanceof Date
      ? lastSyncedAt.getTime()
      : new Date(lastSyncedAt).getTime();
  if (!Number.isFinite(ts)) return true;
  return nowMs - ts > thresholdMs;
}

export function resolveIsStale(
  dbIsStale: boolean,
  lastSyncedAt: Date | string | null | undefined,
): boolean {
  return dbIsStale || computeIsStale(lastSyncedAt);
}

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
  @ApiProperty({ type: String, nullable: true }) supermarketColor: string | null;
  @ApiProperty({ example: 1.99 }) price: number;
  @ApiProperty({ type: () => UnitPriceDto, nullable: true })
  unitPrice: UnitPrice | null;
  @ApiProperty() onPromotion: boolean;
  @ApiProperty({ type: Number, nullable: true }) previousPrice: number | null;
  @ApiProperty() isAvailable: boolean;
  @ApiProperty() isStale: boolean;
  @ApiProperty() lastSyncedAt: Date;
  @ApiProperty({ example: 1.0 }) confidenceScore: number;
}

export class ProductResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) brand: string | null;
  @ApiProperty({ type: String, nullable: true }) imageUrl: string | null;
  @ApiProperty({ type: String, nullable: true }) categoryId: string | null;
  @ApiProperty() packageSize: number;
  @ApiProperty({ enum: Object.values(MeasureUnit) }) packageUnit: string;
  @ApiProperty({ enum: Object.values(MeasureUnit) }) comparisonUnit: string;

  // Sprint 244 (ADR 0044): read path agrega preços do grupo canônico.
  // `canonicalProductId` é SEMPRE null quando o endpoint retorna o
  // canônico (findById resolve child→canonical antes); o campo existe
  // pro contrato OpenAPI mas não deve bater valor na prática via API.
  // `canonicalGroupSize` = 1 (standalone) ou N quando há duplicates
  // linkados. `isSameProduct` = shortcut pro badge verde no front.
  @ApiProperty({ type: String, nullable: true })
  canonicalProductId: string | null;
  @ApiProperty({ example: 1, minimum: 1 }) canonicalGroupSize: number;
  @ApiProperty() isSameProduct: boolean;

  // Nutrição
  @ApiProperty({ type: Number, nullable: true }) calories: number | null;
  @ApiProperty({ type: Number, nullable: true }) protein: number | null;
  @ApiProperty({ type: Number, nullable: true }) fat: number | null;
  @ApiProperty({ type: Number, nullable: true }) saturatedFat: number | null;
  @ApiProperty({ type: Number, nullable: true }) carbs: number | null;
  @ApiProperty({ type: Number, nullable: true }) sugar: number | null;
  @ApiProperty({ type: Number, nullable: true }) salt: number | null;
  @ApiProperty({ type: Number, nullable: true }) fiber: number | null;
  @ApiProperty({ type: Number, nullable: true, description: 'Base amount (100 for per-100g/ml, 1 for per-unit)' })
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

  @ApiProperty({ type: String, nullable: true })
  cheapestSupermarketSlug: string | null;

  @ApiProperty({ type: Number, nullable: true })
  cheapestPrice: number | null;

  @ApiProperty({ type: () => UnitPriceDto, nullable: true })
  cheapestUnitPrice: UnitPrice | null;

  // Sprint 226 (ADR 0034): preço cheapest desatualizado (horas desde
  // lastSyncedAt > PRICE_STALE_THRESHOLD_HOURS). Base pra badge home/lista/
  // favoritos. Badge por mercado usa `PriceByMarketDto.isStale`.
  @ApiProperty() isStale: boolean;

  static fromEntity(
    product: Product & {
      prices?: (ProductPrice & { supermarket: Supermarket })[];
      category?: Category | null;
      // Sprint 244 (ADR 0044): duplicates do grupo canônico com seus
      // prices. Loaded via include em repositórios que fazem read path
      // canônico. Preços agregados + dedupe por supermarketId.
      duplicates?: (Product & {
        prices?: (ProductPrice & { supermarket: Supermarket })[];
      })[];
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
    dto.canonicalProductId = product.canonicalProductId ?? null;
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
      fat: dto.fat,
      salt: dto.salt,
      fiber: dto.fiber,
      protein: dto.protein,
      nutritionPer: dto.nutritionPer,
      comparisonUnit: product.comparisonUnit,
      category: resolveNutriCategory(product.category?.slug),
    });
    dto.isVegan = product.isVegan;
    dto.isVegetarian = product.isVegetarian;
    dto.isGlutenFree = product.isGlutenFree;
    dto.isLactoseFree = product.isLactoseFree;

    // Sprint 244 (ADR 0044): merge prices do canonical + duplicates.
    // Cluster rule S232 garante super_ids DISJUNTOS entre membros, mas
    // dedupe por supermarketId defende contra legado S228 pré-G3.
    // Tiebreak: lastSyncedAt DESC (preço mais fresco vence).
    const duplicates = product.duplicates ?? [];
    const rawPrices = [
      ...(product.prices ?? []),
      ...duplicates.flatMap((d) => d.prices ?? []),
    ];
    const pricesBySuper = new Map<
      string,
      ProductPrice & { supermarket: Supermarket }
    >();
    for (const p of rawPrices) {
      const existing = pricesBySuper.get(p.supermarketId);
      if (!existing) {
        pricesBySuper.set(p.supermarketId, p);
        continue;
      }
      const ea = new Date(existing.lastSyncedAt).getTime();
      const na = new Date(p.lastSyncedAt).getTime();
      if (na > ea) pricesBySuper.set(p.supermarketId, p);
    }
    const prices = [...pricesBySuper.values()].map((p) =>
      mapPrice(
        p,
        Number(product.packageSize),
        product.packageUnit,
        product.comparisonUnit,
      ),
    );
    dto.prices = prices;
    dto.canonicalGroupSize = 1 + duplicates.length;
    dto.isSameProduct = dto.canonicalGroupSize > 1;

    const availablePrices = prices.filter((p) => p.isAvailable);
    if (availablePrices.length > 0) {
      const cheapest = availablePrices.reduce((a, b) =>
        a.price < b.price ? a : b,
      );
      dto.cheapestSupermarketSlug = cheapest.supermarketSlug;
      dto.cheapestPrice = cheapest.price;
      dto.cheapestUnitPrice = cheapest.unitPrice;
      dto.isStale = cheapest.isStale;
    } else {
      dto.cheapestSupermarketSlug = null;
      dto.cheapestPrice = null;
      dto.cheapestUnitPrice = null;
      dto.isStale = false;
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
    isStale: resolveIsStale(p.isStale, p.lastSyncedAt),
    lastSyncedAt: p.lastSyncedAt,
    confidenceScore: Number(p.confidenceScore),
  };
}
