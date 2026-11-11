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

export interface SupermarketAdapter {
  readonly slug: string;
  fetchProducts(options?: { postalCode?: string }): Promise<RawProduct[]>;
}
