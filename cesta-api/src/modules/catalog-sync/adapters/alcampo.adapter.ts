import { Injectable, Logger } from '@nestjs/common';
import { politeFetch } from '../utils/polite-fetch';
import { pickUserAgent } from '../utils/user-agents';
import type {
  RawPackageUnit,
  RawProduct,
  SupermarketAdapter,
} from './supermarket-adapter.interface';

// Alcampo (grupo Auchan) — protegido por CDN. Estratégia polite-fetch:
// UA rotativo, jitter 3-7s, backoff em 429/403, defensivo.
const BASE_URL = 'https://www.alcampo.es/api/v1/search';
const MAX_PER_QUERY = 50;

const SEED_QUERIES = [
  'leche', 'yogur', 'queso', 'huevos',
  'pan', 'cereales',
  'pollo', 'carne picada', 'jamon',
  'salmon', 'atun',
  'platano', 'tomate', 'patatas', 'manzana',
  'agua', 'coca cola', 'cerveza',
  'aceite oliva', 'arroz', 'pasta', 'azucar',
  'pizza congelada',
  'detergente', 'papel higienico',
  'champu', 'pasta dentifrica',
];

interface AlcampoProduct {
  id?: string | number;
  sku?: string;
  name?: string;
  display_name?: string;
  brand?: string | null;
  ean?: string | null;
  image?: string | null;
  images?: Array<{ url?: string }>;
  price?: number | string | { current?: number | string; previous?: number | string } | null;
  promotion?: { active?: boolean } | null;
  is_promotion?: boolean | null;
  availability?: string | { available?: boolean } | null;
  package?: { size?: number | string; unit?: string } | null;
  categories?: string[] | Array<{ name?: string }>;
}

interface AlcampoResponse {
  products?: AlcampoProduct[];
  results?: AlcampoProduct[];
  items?: AlcampoProduct[];
}

@Injectable()
export class AlcampoAdapter implements SupermarketAdapter {
  readonly slug = 'alcampo';
  private readonly logger = new Logger(AlcampoAdapter.name);

  async fetchProducts(): Promise<RawProduct[]> {
    const seen = new Set<string>();
    const products: RawProduct[] = [];

    for (const query of SEED_QUERIES) {
      try {
        const data = await this.search(query);
        const raws = this.extract(data);
        for (const raw of raws) {
          const id = this.resolveId(raw);
          if (!id || seen.has(id)) continue;
          const normalized = this.normalize(raw, id);
          if (!normalized) continue;
          seen.add(id);
          products.push(normalized);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Alcampo query "${query}" falhou: ${msg}`);
      }
    }

    this.logger.log(`Alcampo: ${products.length} produtos coletados`);
    return products;
  }

  private async search(query: string): Promise<AlcampoResponse | null> {
    const url = `${BASE_URL}?q=${encodeURIComponent(query)}&limit=${MAX_PER_QUERY}`;
    try {
      return await politeFetch<AlcampoResponse>(url, {
        userAgent: pickUserAgent(),
        referer: 'https://www.alcampo.es/',
        minJitterMs: 3000,
        maxJitterMs: 7000,
        maxRetries: 3,
        initialBackoffMs: 4000,
        onRetry: (attempt, status) => {
          this.logger.warn(
            `Alcampo retry ${attempt} (status=${status ?? 'network'}) query=${query}`,
          );
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Alcampo fetch "${query}" falhou: ${msg}`);
      return null;
    }
  }

  private extract(data: AlcampoResponse | null): AlcampoProduct[] {
    if (!data) return [];
    return data.products ?? data.results ?? data.items ?? [];
  }

  private resolveId(raw: AlcampoProduct): string | null {
    const id = raw.id ?? raw.sku;
    return id != null ? String(id) : null;
  }

  private normalize(raw: AlcampoProduct, id: string): RawProduct | null {
    const name = raw.display_name ?? raw.name;
    if (!name) return null;

    const { price, previousPrice } = this.extractPrices(raw.price);
    if (!Number.isFinite(price) || price <= 0) return null;

    const onPromotion =
      raw.promotion?.active === true || raw.is_promotion === true;

    const isAvailable =
      typeof raw.availability === 'string'
        ? raw.availability.toLowerCase() !== 'out_of_stock'
        : raw.availability?.available !== false;

    const { packageSize, packageUnit, comparisonUnit } = this.parsePackage(
      raw.package?.size,
      raw.package?.unit,
      name,
    );

    const imageUrl =
      raw.image ??
      (Array.isArray(raw.images) ? raw.images[0]?.url ?? null : null) ??
      null;

    const categoryHint = Array.isArray(raw.categories)
      ? typeof raw.categories[0] === 'string'
        ? (raw.categories[0] as string)
        : (raw.categories[0] as { name?: string })?.name ?? null
      : null;

    return {
      externalId: id,
      name,
      brand: raw.brand ?? null,
      ean: raw.ean ?? null,
      categoryHint,
      imageUrl,
      packageSize,
      packageUnit,
      comparisonUnit,
      price: Math.round(price * 100) / 100,
      onPromotion,
      previousPrice:
        previousPrice && Number.isFinite(previousPrice) ? previousPrice : null,
      isAvailable,
    };
  }

  private extractPrices(
    priceField: AlcampoProduct['price'],
  ): { price: number; previousPrice: number | null } {
    if (priceField == null) return { price: NaN, previousPrice: null };
    if (typeof priceField === 'number') {
      return { price: priceField, previousPrice: null };
    }
    if (typeof priceField === 'string') {
      return { price: parseFloat(priceField), previousPrice: null };
    }
    const current = priceField.current;
    const previous = priceField.previous;
    return {
      price: typeof current === 'string' ? parseFloat(current) : Number(current),
      previousPrice:
        previous != null
          ? typeof previous === 'string'
            ? parseFloat(previous)
            : Number(previous)
          : null,
    };
  }

  private parsePackage(
    size: number | string | undefined,
    unit: string | undefined,
    fallback: string,
  ): {
    packageSize: number;
    packageUnit: RawPackageUnit;
    comparisonUnit: RawPackageUnit;
  } {
    const qty =
      size != null && Number.isFinite(Number(size))
        ? Number(size)
        : this.extractQtyFromName(fallback);
    const unitStr = (unit ?? this.extractUnitFromName(fallback) ?? '').toLowerCase();

    let packageUnit: RawPackageUnit = 'UNIT';
    if (/\bl\b|litro/.test(unitStr)) packageUnit = 'LITER';
    else if (/\bml\b/.test(unitStr)) packageUnit = 'MILLILITER';
    else if (/\bkg\b|kilo/.test(unitStr)) packageUnit = 'KILOGRAM';
    else if (/\bg\b|\bgr\b/.test(unitStr)) packageUnit = 'GRAM';

    const comparisonUnit: RawPackageUnit =
      packageUnit === 'LITER' || packageUnit === 'MILLILITER'
        ? 'LITER'
        : packageUnit === 'KILOGRAM' || packageUnit === 'GRAM'
          ? 'KILOGRAM'
          : 'UNIT';

    return {
      packageSize: qty > 0 ? qty : 1,
      packageUnit,
      comparisonUnit,
    };
  }

  private extractQtyFromName(name: string): number {
    const m = name.match(/(\d+(?:[.,]\d+)?)\s*(l|ml|kg|g|gr|ud|un)/i);
    if (!m) return 1;
    const v = parseFloat(m[1].replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? v : 1;
  }

  private extractUnitFromName(name: string): string | null {
    const m = name.match(/\b(l|ml|kg|g|gr|ud|un)\b/i);
    return m ? m[1] : null;
  }
}
