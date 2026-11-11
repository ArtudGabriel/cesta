import { Injectable, Logger } from '@nestjs/common';
import { politeFetch } from '../utils/polite-fetch';
import { pickUserAgent } from '../utils/user-agents';
import type {
  RawPackageUnit,
  RawProduct,
  SupermarketAdapter,
} from './supermarket-adapter.interface';

// Carrefour Espanha não expõe API pública. Este adapter usa a search-api
// interna. O site tem Akamai Bot Manager; estratégia polite-fetch:
//  - UA rotativo (pool de navegadores atuais)
//  - Jitter aleatório 3-7s entre queries
//  - Backoff exponencial em 429/403/503 respeitando Retry-After
//  - Referer + Sec-Fetch-* humanizados
//  - Falha de query não aborta o run (defensivo)
//
// Se Akamai bloquear, o adapter retorna [] e o run termina como "failed" ou
// "partial" sem quebrar o sistema. Preços oficiais do Carrefour vêm por aqui;
// caso bloqueie em produção, considerar scraping via Puppeteer com proxy.

const BASE_URL = 'https://www.carrefour.es/search-api/query/v1/products';
const MAX_PER_QUERY = 50;

// Queries base para varredura — cobre maioria das categorias
const SEED_QUERIES = [
  'leche',
  'yogur',
  'queso',
  'huevos',
  'pan',
  'cereales',
  'pollo',
  'carne picada',
  'jamon',
  'salmon',
  'atun',
  'platano',
  'tomate',
  'patatas',
  'manzana',
  'agua',
  'coca cola',
  'cerveza',
  'aceite oliva',
  'arroz',
  'pasta',
  'azucar',
  'pizza congelada',
  'detergente',
  'papel higienico',
  'champu',
  'pasta dentifrica',
];

interface CarrefourProduct {
  id: string;
  display_name?: string;
  title?: string;
  brand?: string | null;
  ean?: string | null;
  image_path?: string | null;
  images?: Array<{ url?: string }>;
  price?: number | string | null;
  price_info?: {
    current_price?: number | string | null;
    previous_price?: number | string | null;
    price_per_unit?: string | null;
    on_promotion?: boolean | null;
  };
  availability?: { is_available?: boolean } | null;
  package_info?: {
    quantity?: number | string | null;
    unit_of_measure?: string | null;
  } | null;
  category_names?: string[];
}

interface CarrefourSearchResponse {
  results?: CarrefourProduct[];
  content?: CarrefourProduct[];
  items?: CarrefourProduct[];
  total?: number;
}

@Injectable()
export class CarrefourAdapter implements SupermarketAdapter {
  readonly slug = 'carrefour';
  private readonly logger = new Logger(CarrefourAdapter.name);

  async fetchProducts(): Promise<RawProduct[]> {
    const seen = new Set<string>();
    const products: RawProduct[] = [];

    for (const query of SEED_QUERIES) {
      try {
        const data = await this.search(query);
        const raws = this.extractProducts(data);
        for (const raw of raws) {
          if (seen.has(raw.id)) continue;
          const normalized = this.normalize(raw);
          if (!normalized) continue;
          seen.add(raw.id);
          products.push(normalized);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Carrefour query "${query}" falhou: ${message}`);
      }
    }

    this.logger.log(`Carrefour: ${products.length} produtos coletados`);
    return products;
  }

  private async search(query: string): Promise<CarrefourSearchResponse | null> {
    const url = `${BASE_URL}?query=${encodeURIComponent(query)}&offset=0&limit=${MAX_PER_QUERY}`;
    try {
      return await politeFetch<CarrefourSearchResponse>(url, {
        userAgent: pickUserAgent(),
        referer: 'https://www.carrefour.es/',
        minJitterMs: 3000,
        maxJitterMs: 7000,
        maxRetries: 3,
        initialBackoffMs: 4000,
        onRetry: (attempt, status) => {
          this.logger.warn(
            `Carrefour retry ${attempt} (status=${status ?? 'network'}) query=${query}`,
          );
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Carrefour fetch "${query}" falhou: ${message}`);
      return null;
    }
  }

  private extractProducts(
    data: CarrefourSearchResponse | null,
  ): CarrefourProduct[] {
    if (!data) return [];
    return data.results ?? data.content ?? data.items ?? [];
  }

  private normalize(raw: CarrefourProduct): RawProduct | null {
    const name = raw.display_name ?? raw.title;
    if (!name) return null;

    const priceRaw =
      raw.price_info?.current_price ?? raw.price ?? null;
    if (priceRaw == null) return null;
    const price = typeof priceRaw === 'string' ? parseFloat(priceRaw) : Number(priceRaw);
    if (!Number.isFinite(price) || price <= 0) return null;

    const previousRaw = raw.price_info?.previous_price ?? null;
    const previousPrice =
      previousRaw != null && previousRaw !== ''
        ? parseFloat(String(previousRaw))
        : null;

    const { packageSize, packageUnit, comparisonUnit } = this.parsePackage(
      raw.package_info?.quantity,
      raw.package_info?.unit_of_measure,
      name,
    );

    const imageUrl =
      raw.image_path ?? raw.images?.[0]?.url ?? null;

    return {
      externalId: raw.id,
      name,
      brand: raw.brand ?? null,
      ean: raw.ean ?? null,
      categoryHint: raw.category_names?.[0] ?? null,
      imageUrl,
      packageSize,
      packageUnit,
      comparisonUnit,
      price: Math.round(price * 100) / 100,
      onPromotion: raw.price_info?.on_promotion === true,
      previousPrice:
        previousPrice && Number.isFinite(previousPrice) ? previousPrice : null,
      isAvailable: raw.availability?.is_available !== false,
    };
  }

  private parsePackage(
    quantity: number | string | null | undefined,
    unit: string | null | undefined,
    fallbackName: string,
  ): {
    packageSize: number;
    packageUnit: RawPackageUnit;
    comparisonUnit: RawPackageUnit;
  } {
    const qty =
      quantity != null && Number.isFinite(Number(quantity))
        ? Number(quantity)
        : this.extractQuantityFromName(fallbackName);
    const unitLower = (unit || this.extractUnitFromName(fallbackName) || '')
      .toLowerCase()
      .trim();

    let packageUnit: RawPackageUnit = 'UNIT';
    if (/\bl\b|litro/.test(unitLower)) packageUnit = 'LITER';
    else if (/\bml\b/.test(unitLower)) packageUnit = 'MILLILITER';
    else if (/\bkg\b|kilo/.test(unitLower)) packageUnit = 'KILOGRAM';
    else if (/\bg\b|\bgr\b/.test(unitLower)) packageUnit = 'GRAM';

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

  private extractQuantityFromName(name: string): number {
    const match = name.match(/(\d+(?:[.,]\d+)?)\s*(l|ml|kg|g|gr|ud|un)/i);
    if (!match) return 1;
    const value = parseFloat(match[1].replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  private extractUnitFromName(name: string): string | null {
    const match = name.match(/\b(l|ml|kg|g|gr|ud|un)\b/i);
    return match ? match[1] : null;
  }
}
