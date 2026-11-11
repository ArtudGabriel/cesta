import { Injectable, Logger } from '@nestjs/common';
import type {
  RawPackageUnit,
  RawProduct,
  SupermarketAdapter,
} from './supermarket-adapter.interface';

// DIA (dia.es) expõe search-api interna. Resposta JSON com produtos; estrutura
// pode mudar sem aviso. Best-effort.
// Endpoint: dia.es/api/v1/search-engine/products/search?q=X

const BASE_URL = 'https://www.dia.es/api/v1/search-engine/products/search';
const USER_AGENT = 'Cesta-App/0.1 (+contact: gabriel.augusto@vonex.com.br)';
const FETCH_DELAY_MS = 2000;
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

interface DiaProduct {
  id?: string | number;
  product_id?: string;
  display_name?: string;
  name?: string;
  brand?: string | null;
  ean?: string | null;
  images?: string[] | Array<{ large_url?: string; medium_url?: string }>;
  prices?: {
    price?: number | string;
    original_price?: number | string;
    unit_price?: string;
  };
  price_per_kg?: number | string | null;
  has_offer?: boolean;
  in_stock?: boolean;
  weight?: number | string;
  format?: string;
  measurement_unit?: string;
  category_hierarchy?: Array<{ name?: string }>;
}

interface DiaResponse {
  search_items?: DiaProduct[];
  products?: DiaProduct[];
  results?: DiaProduct[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

@Injectable()
export class DiaAdapter implements SupermarketAdapter {
  readonly slug = 'dia';
  private readonly logger = new Logger(DiaAdapter.name);

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
        this.logger.warn(`DIA query "${query}" falhou: ${msg}`);
      }
      await sleep(FETCH_DELAY_MS);
    }

    this.logger.log(`DIA: ${products.length} produtos coletados`);
    return products;
  }

  private async search(query: string): Promise<DiaResponse | null> {
    const url = `${BASE_URL}?q=${encodeURIComponent(query)}&page_size=${MAX_PER_QUERY}&page=1`;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          'Accept-Language': 'es-ES,es;q=0.9',
        },
      });
      if (!response.ok) {
        this.logger.warn(`DIA ${query} → ${response.status}`);
        return null;
      }
      return (await response.json()) as DiaResponse;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`DIA fetch "${query}" falhou: ${msg}`);
      return null;
    }
  }

  private extract(data: DiaResponse | null): DiaProduct[] {
    if (!data) return [];
    return data.search_items ?? data.products ?? data.results ?? [];
  }

  private resolveId(raw: DiaProduct): string | null {
    const id = raw.id ?? raw.product_id;
    return id != null ? String(id) : null;
  }

  private normalize(raw: DiaProduct, id: string): RawProduct | null {
    const name = raw.display_name ?? raw.name;
    if (!name) return null;

    const priceRaw = raw.prices?.price;
    if (priceRaw == null) return null;
    const price = typeof priceRaw === 'string' ? parseFloat(priceRaw) : Number(priceRaw);
    if (!Number.isFinite(price) || price <= 0) return null;

    const prevRaw = raw.prices?.original_price;
    const previousPrice =
      prevRaw != null && prevRaw !== ''
        ? parseFloat(String(prevRaw))
        : null;

    const { packageSize, packageUnit, comparisonUnit } = this.parsePackage(
      raw.weight,
      raw.measurement_unit ?? raw.format,
      name,
    );

    const imageUrl = this.resolveImage(raw.images);
    const categoryHint = raw.category_hierarchy?.[0]?.name ?? null;

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
      onPromotion: raw.has_offer === true,
      previousPrice:
        previousPrice && Number.isFinite(previousPrice) ? previousPrice : null,
      isAvailable: raw.in_stock !== false,
    };
  }

  private resolveImage(
    images: DiaProduct['images'] | undefined,
  ): string | null {
    if (!images) return null;
    if (Array.isArray(images)) {
      const first = images[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object') {
        return first.large_url ?? first.medium_url ?? null;
      }
    }
    return null;
  }

  private parsePackage(
    weight: number | string | undefined,
    unit: string | undefined,
    fallback: string,
  ): {
    packageSize: number;
    packageUnit: RawPackageUnit;
    comparisonUnit: RawPackageUnit;
  } {
    const qty =
      weight != null && Number.isFinite(Number(weight))
        ? Number(weight)
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
