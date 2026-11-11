import { Injectable, Logger } from '@nestjs/common';
import { politeFetch } from '../utils/polite-fetch';
import { IDENTIFIED_UA } from '../utils/user-agents';
import type {
  RawPackageUnit,
  RawProduct,
  SupermarketAdapter,
} from './supermarket-adapter.interface';

// Mercadona expõe uma API semi-pública em tienda.mercadona.es.
// Preços variam por "warehouse" (wh). "mad1" cobre a maior parte da região de Madrid.
// Documentação é observacional; o endpoint pode mudar sem aviso.
// Mercadona é tolerante — usa UA identificado + jitter curto.
const BASE_URL = 'https://tienda.mercadona.es/api';
const DEFAULT_WH = 'mad1';

interface MercadonaCategory {
  id: number;
  name: string;
  categories?: MercadonaCategory[];
}

interface MercadonaProduct {
  id: string;
  display_name: string;
  ean?: string | null;
  brand?: string | null;
  thumbnail?: string | null;
  price_instructions?: {
    unit_price?: string | number | null;
    price_decreased?: boolean | null;
    previous_unit_price?: string | number | null;
    bulk_price?: string | null;
    size_format?: string | null;
    reference_format?: string | null;
    unit_size?: number | string | null;
    reference_price?: string | null;
    iva?: number | null;
  } | null;
  packaging?: string | null;
  categories?: MercadonaCategory[] | null;
  active?: boolean;
  unavailable_from?: string | null;
}

interface MercadonaCategoryWithProducts extends MercadonaCategory {
  categories?: Array<
    MercadonaCategory & {
      products?: MercadonaProduct[];
    }
  >;
  products?: MercadonaProduct[];
}

@Injectable()
export class MercadonaAdapter implements SupermarketAdapter {
  readonly slug = 'mercadona';
  private readonly logger = new Logger(MercadonaAdapter.name);

  async fetchProducts(options: { postalCode?: string } = {}): Promise<RawProduct[]> {
    const wh = options.postalCode ? this.resolveWarehouse(options.postalCode) : DEFAULT_WH;
    const rootCategories = await this.fetchCategoriesTree(wh);
    if (!rootCategories || rootCategories.length === 0) {
      this.logger.warn('Mercadona: zero categorias retornadas');
      return [];
    }

    const products: RawProduct[] = [];

    for (const root of rootCategories) {
      const children = root.categories ?? [root];
      for (const sub of children) {
        try {
          const detailed = await this.fetchCategory(sub.id, wh);
          const leaves = this.flattenProducts(detailed);
          for (const raw of leaves) {
            const normalized = this.normalize(raw, sub.name);
            if (normalized) products.push(normalized);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Mercadona cat ${sub.id} falhou: ${message}`);
        }
      }
    }

    this.logger.log(`Mercadona: ${products.length} produtos coletados`);
    return products;
  }

  private async fetchCategoriesTree(wh: string): Promise<MercadonaCategory[]> {
    const url = `${BASE_URL}/v1_1/categories/?lang=es&wh=${encodeURIComponent(wh)}`;
    const data = await this.fetchJson<{ results: MercadonaCategory[] }>(url);
    return data?.results ?? [];
  }

  private async fetchCategory(
    id: number,
    wh: string,
  ): Promise<MercadonaCategoryWithProducts> {
    const url = `${BASE_URL}/categories/${id}/?lang=es&wh=${encodeURIComponent(wh)}`;
    const data = await this.fetchJson<MercadonaCategoryWithProducts>(url);
    return data ?? { id, name: '' };
  }

  private flattenProducts(
    category: MercadonaCategoryWithProducts,
  ): MercadonaProduct[] {
    const out: MercadonaProduct[] = [];
    if (category.products) out.push(...category.products);
    if (category.categories) {
      for (const sub of category.categories) {
        if (sub.products) out.push(...sub.products);
      }
    }
    return out;
  }

  private normalize(
    raw: MercadonaProduct,
    categoryHint: string,
  ): RawProduct | null {
    const priceInstr = raw.price_instructions;
    const priceStr = priceInstr?.unit_price;
    if (priceStr == null) return null;

    const price = typeof priceStr === 'string' ? parseFloat(priceStr) : Number(priceStr);
    if (!Number.isFinite(price) || price <= 0) return null;

    const { packageSize, packageUnit, comparisonUnit } = this.parsePackage(
      priceInstr?.size_format ?? null,
      priceInstr?.unit_size,
      priceInstr?.reference_format ?? null,
      raw.packaging ?? null,
    );

    const previousPriceStr = priceInstr?.previous_unit_price;
    const previousPrice =
      previousPriceStr != null && previousPriceStr !== ''
        ? parseFloat(String(previousPriceStr))
        : null;

    return {
      externalId: raw.id,
      name: raw.display_name,
      brand: raw.brand ?? null,
      ean: raw.ean ?? null,
      categoryHint,
      imageUrl: raw.thumbnail ?? null,
      packageSize,
      packageUnit,
      comparisonUnit,
      price: Math.round(price * 100) / 100,
      onPromotion: priceInstr?.price_decreased === true,
      previousPrice:
        previousPrice && Number.isFinite(previousPrice) ? previousPrice : null,
      isAvailable: raw.active !== false && !raw.unavailable_from,
    };
  }

  private parsePackage(
    sizeFormat: string | null,
    unitSize: number | string | null | undefined,
    referenceFormat: string | null,
    packaging: string | null,
  ): { packageSize: number; packageUnit: RawPackageUnit; comparisonUnit: RawPackageUnit } {
    // size_format vem como "1 l", "500 g", "12 ud"; unit_size às vezes traz o valor numérico
    const text = (sizeFormat || packaging || '').toLowerCase().trim();
    let packageSize = 1;
    let packageUnit: RawPackageUnit = 'UNIT';

    const numeric =
      unitSize != null && Number.isFinite(Number(unitSize))
        ? Number(unitSize)
        : parseFloat(text.replace(',', '.'));

    if (/\bl\b|litro/.test(text)) {
      packageUnit = 'LITER';
      packageSize = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
    } else if (/\bml\b/.test(text)) {
      packageUnit = 'MILLILITER';
      packageSize = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
    } else if (/\bkg\b|kilo/.test(text)) {
      packageUnit = 'KILOGRAM';
      packageSize = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
    } else if (/\bg\b|gr/.test(text)) {
      packageUnit = 'GRAM';
      packageSize = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
    } else {
      packageUnit = 'UNIT';
      packageSize = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
    }

    // comparisonUnit = L se packageUnit é líquido, KG se sólido, UNIT caso contrário
    const comparisonUnit: RawPackageUnit =
      packageUnit === 'LITER' || packageUnit === 'MILLILITER'
        ? 'LITER'
        : packageUnit === 'KILOGRAM' || packageUnit === 'GRAM'
          ? 'KILOGRAM'
          : 'UNIT';

    // Adjust reference format quando disponível (ex: "por litro", "por kg")
    const ref = (referenceFormat ?? '').toLowerCase();
    if (/litro|\bl\b/.test(ref)) {
      // compara por 1L
    } else if (/kg|kilo/.test(ref)) {
      // compara por 1kg
    } else if (/unidad|unit/.test(ref)) {
      // compara por 1un — já default
    }

    return { packageSize, packageUnit, comparisonUnit };
  }

  private resolveWarehouse(postalCode: string): string {
    // Mapa simples — pode expandir no futuro
    if (postalCode.startsWith('28')) return 'mad1'; // Madrid
    if (postalCode.startsWith('08')) return 'bcn1'; // Barcelona
    if (postalCode.startsWith('46')) return 'vlc1'; // Valencia
    return DEFAULT_WH;
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    try {
      return await politeFetch<T>(url, {
        userAgent: IDENTIFIED_UA,
        referer: 'https://tienda.mercadona.es/',
        minJitterMs: 800,
        maxJitterMs: 1800,
        maxRetries: 2,
        onRetry: (attempt, status) => {
          this.logger.warn(
            `Mercadona retry ${attempt} (status=${status ?? 'network'})`,
          );
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Mercadona fetch failed: ${message}`);
      return null;
    }
  }
}
