import { MeasureUnit } from '@prisma/client';

export type UnitPriceSuffix = 'L' | 'kg' | '100g' | '100ml' | 'un';

export interface UnitPrice {
  value: number;
  unit: UnitPriceSuffix;
}

const MASS: ReadonlySet<MeasureUnit> = new Set([
  MeasureUnit.KILOGRAM,
  MeasureUnit.GRAM,
]);
const VOLUME: ReadonlySet<MeasureUnit> = new Set([
  MeasureUnit.LITER,
  MeasureUnit.MILLILITER,
]);

function dimensionOf(u: MeasureUnit): 'mass' | 'volume' | 'unit' {
  if (MASS.has(u)) return 'mass';
  if (VOLUME.has(u)) return 'volume';
  return 'unit';
}

export function calculateUnitPrice(
  price: number,
  packageSize: number,
  packageUnit: MeasureUnit,
  comparisonUnit: MeasureUnit,
): UnitPrice {
  if (!(price > 0) || !(packageSize > 0)) {
    throw new Error(
      `calculateUnitPrice: price and packageSize must be positive (got price=${price}, size=${packageSize})`,
    );
  }
  if (dimensionOf(packageUnit) !== dimensionOf(comparisonUnit)) {
    throw new Error(
      `calculateUnitPrice: incompatible units (packageUnit=${packageUnit}, comparisonUnit=${comparisonUnit})`,
    );
  }

  // Normaliza embalagem para unidade-base da dimensão (L ou kg ou un).
  let sizeInBase = packageSize;
  if (packageUnit === MeasureUnit.MILLILITER) sizeInBase = packageSize / 1000;
  else if (packageUnit === MeasureUnit.GRAM) sizeInBase = packageSize / 1000;

  switch (comparisonUnit) {
    case MeasureUnit.LITER:
      return { value: round4(price / sizeInBase), unit: 'L' };
    case MeasureUnit.MILLILITER:
      return { value: round4((price / sizeInBase) * 0.1), unit: '100ml' };
    case MeasureUnit.KILOGRAM:
      return { value: round4(price / sizeInBase), unit: 'kg' };
    case MeasureUnit.GRAM:
      return { value: round4((price / sizeInBase) * 0.1), unit: '100g' };
    case MeasureUnit.UNIT:
      return { value: round4(price / packageSize), unit: 'un' };
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
