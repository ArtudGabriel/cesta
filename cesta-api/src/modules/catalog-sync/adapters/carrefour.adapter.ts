import { Injectable, Logger } from '@nestjs/common';
import { pickUserAgent } from '../utils/user-agents';
import {
  closePuppeteerBrowser,
  puppeteerFetch,
} from '../utils/puppeteer-fetch';
import type {
  RawPackageUnit,
  RawProduct,
  SupermarketAdapter,
} from './supermarket-adapter.interface';

// Carrefour (www.carrefour.es) — S118/S119/S120 tentativas raw fetch retornaram
// 403 Akamai persistente. S128 pivot pra Puppeteer headless: renderiza páginas
// de resultado via Chromium, Akamai _abck challenge executa, HTML real volta.
//
// Estratégia:
//  1. Puppeteer navigate `https://www.carrefour.es/search?q=<query>` (SSR Next.js)
//  2. Aguarda JS hydration (networkidle2 + extraWaitMs)
//  3. Extrai produtos de `__NEXT_DATA__` script (SSR Next.js embed inicial)
//  4. Fallback: scan DOM via Cheerio se __NEXT_DATA__ ausente
const BASE_URL = 'https://www.carrefour.es/search';
const MAX_QUERIES = 20;

const SEED_QUERIES = [
  'leche', 'yogur', 'queso', 'huevos',
  'pan', 'cereales',
  'pollo', 'carne picada', 'jamon',
  'salmon', 'atun',
  'platano', 'tomate', 'patatas', 'manzana',
  'agua', 'coca cola', 'aceite oliva', 'arroz', 'pasta',
];

interface CarrefourNextProduct {
  id?: string | number;
  display_name?: string;
  title?: string;
  brand?: string | null;
  ean?: string | null;
  image_path?: string | null;
  price?: number | string | null;
  price_info?: {
    current_price?: number | string | null;
    previous_price?: number | string | null;
    on_promotion?: boolean | null;
  };
  availability?: { is_available?: boolean } | null;
  package_info?: {
    quantity?: number | string | null;
    unit_of_measure?: string | null;
  } | null;
  category_names?: string[];
}

@Injectable()
export class CarrefourAdapter implements SupermarketAdapter {
  readonly slug = 'carrefour';
  private readonly logger = new Logger(CarrefourAdapter.name);
  private readonly ua = pickUserAgent();

  async fetchProducts(): Promise<RawProduct[]> {
    const seen = new Set<string>();
    const products: RawProduct[] = [];
    const queries = SEED_QUERIES.slice(0, MAX_QUERIES);

    try {
      for (const query of queries) {
        try {
          const raws = await this.searchViaPuppeteer(query);
          for (const raw of raws) {
            const id = raw.id != null ? String(raw.id) : null;
            if (!id || seen.has(id)) continue;
            const normalized = this.normalize(raw, id);
            if (!normalized) continue;
            seen.add(id);
            products.push(normalized);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Carrefour query "${query}" falhou: ${msg}`);
        }
      }
    } finally {
      // Sempre fechar browser para liberar memória antes do próximo job
      // (Render free tier 512MB — Chromium ~200MB + Node ~150MB).
      await closePuppeteerBrowser();
    }

    this.logger.log(
      `Carrefour: ${products.length} produtos coletados (${queries.length} queries via Puppeteer)`,
    );
    return products;
  }

  private async searchViaPuppeteer(
    query: string,
  ): Promise<CarrefourNextProduct[]> {
    const url = `${BASE_URL}?q=${encodeURIComponent(query)}`;
    const result = await puppeteerFetch(url, {
      userAgent: this.ua,
      timeoutMs: 35_000,
      waitForSelector: 'script#__NEXT_DATA__',
      extraWaitMs: 2000,
    });
    if (!result.html) return [];

    const nextDataMatch = result.html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
    );
    if (!nextDataMatch) {
      this.logger.warn(`Carrefour "${query}": __NEXT_DATA__ ausente`);
      return [];
    }
    try {
      const parsed = JSON.parse(nextDataMatch[1]) as Record<string, unknown>;
      return this.scanForProducts(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Carrefour "${query}": parse __NEXT_DATA__ falhou ${msg}`);
      return [];
    }
  }

  /**
   * Walk recursive em __NEXT_DATA__ procurando arrays com objetos que têm
   * forma de produto (id + display_name OR title + price/price_info).
   */
  private scanForProducts(obj: unknown, depth = 0): CarrefourNextProduct[] {
    if (depth > 8 || !obj || typeof obj !== 'object') return [];
    const asRecord = obj as Record<string, unknown>;
    for (const value of Object.values(asRecord)) {
      if (Array.isArray(value) && value.length > 0) {
        const sample = value[0];
        if (
          sample &&
          typeof sample === 'object' &&
          this.looksLikeProduct(sample as Record<string, unknown>)
        ) {
          return value as CarrefourNextProduct[];
        }
      }
      if (value && typeof value === 'object') {
        const found = this.scanForProducts(value, depth + 1);
        if (found.length > 0) return found;
      }
    }
    return [];
  }

  private looksLikeProduct(sample: Record<string, unknown>): boolean {
    const hasId = sample.id != null;
    const hasName = sample.display_name != null || sample.title != null;
    const hasPrice = sample.price != null || sample.price_info != null;
    return hasId && hasName && hasPrice;
  }

  private normalize(raw: CarrefourNextProduct, id: string): RawProduct | null {
    const name = raw.display_name ?? raw.title;
    if (!name) return null;

    const priceRaw =
      raw.price_info?.current_price ?? raw.price ?? null;
    if (priceRaw == null) return null;
    const price =
      typeof priceRaw === 'string' ? parseFloat(priceRaw) : Number(priceRaw);
    if (!Number.isFinite(price) || price <= 0) return null;

    const prevRaw = raw.price_info?.previous_price ?? null;
    const previousPrice =
      prevRaw != null && prevRaw !== ''
        ? parseFloat(String(prevRaw))
        : null;

    const { packageSize, packageUnit, comparisonUnit } = this.parsePackage(
      raw.package_info?.quantity,
      raw.package_info?.unit_of_measure,
      name,
    );

    return {
      externalId: id,
      name,
      brand: raw.brand ?? null,
      ean: raw.ean ?? null,
      categoryHint: raw.category_names?.[0] ?? null,
      imageUrl: raw.image_path ?? null,
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

    return { packageSize: qty > 0 ? qty : 1, packageUnit, comparisonUnit };
  }

  private extractQuantityFromName(name: string): number {
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
