export type RawPackageUnit =
  | 'LITER'
  | 'MILLILITER'
  | 'KILOGRAM'
  | 'GRAM'
  | 'UNIT';

export interface RawProduct {
  externalId: string;
  name: string;
  brand?: string | null;
  ean?: string | null;
  categoryHint?: string | null;
  imageUrl?: string | null;
  packageSize: number;
  packageUnit: RawPackageUnit;
  comparisonUnit: RawPackageUnit;
  price: number;
  onPromotion: boolean;
  previousPrice?: number | null;
  isAvailable: boolean;
}

/**
 * Definição para auto-registro de Supermarket. Adapters introduzidos pós-seed
 * (ex: Eroski S124) expõem definição → service upserta no DB antes de rodar.
 */
export interface SupermarketDefinition {
  slug: string;
  name: string;
  color: string;
}

export interface SupermarketAdapter {
  readonly slug: string;
  readonly definition?: SupermarketDefinition;
  fetchProducts(options?: { postalCode?: string }): Promise<RawProduct[]>;
}
