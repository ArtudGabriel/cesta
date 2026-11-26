import { Injectable, Logger } from '@nestjs/common';
import { politeFetch } from '../utils/polite-fetch';
import { pickUserAgent } from '../utils/user-agents';
import type {
  RawPackageUnit,
  RawProduct,
  SupermarketAdapter,
} from './supermarket-adapter.interface';

// DIA (dia.es) — endpoint descoberto em S122 via probe live:
//  GET https://www.dia.es/api/v1/search-back/search?q=<query>&page=<N>
// Response: { search_items[], pagination: {page_number, page_size, total_pages} }
// Pagination page_size=30; iteramos até total_pages (cap MAX_PAGES_PER_QUERY).
// Image path é relativo (`/product_images/...`) — prepend host.
// Não há EAN público neste endpoint. measure_unit é COMPARISON basis (LITRO/
// KILO/UNIDAD/DOCENA/100 ML.), NÃO package size — esta vem do display_name.
const BASE_URL = 'https://www.dia.es/api/v1/search-back/search';
const IMAGE_HOST = 'https://www.dia.es';
const MAX_PAGES_PER_QUERY = 5;

// Sprint 218 — expanded from 41 to 75 seeds to fill Spanish grocery gaps
// (dairy variants, bakery subs, cured meat, shellfish, more produce staples,
// pantry basics, snacks, cleaning/hygiene breadth, baby/pet category). Pattern
// mirrors S186 LIDL expansion. Ceiling per query ~150 (page_size 30 × 5p cap).
const SEED_QUERIES = [
  'leche', 'yogur', 'queso', 'huevos', 'mantequilla', 'nata', 'batido', 'kefir',
  'pan', 'cereales', 'galletas', 'tostadas', 'bollo', 'croissant', 'magdalena',
  'pollo', 'carne picada', 'jamon', 'chorizo', 'bacon', 'salchicha', 'hamburguesa', 'lomo',
  'salmon', 'atun', 'merluza', 'bacalao', 'gambas', 'mejillones',
  'platano', 'tomate', 'patatas', 'manzana', 'naranja', 'lechuga',
  'cebolla', 'pimiento', 'ajo', 'limon', 'zanahoria', 'pepino', 'aguacate', 'brocoli',
  'agua', 'zumo', 'coca cola', 'cerveza', 'vino', 'refresco', 'cafe', 'te',
  'aceite oliva', 'arroz', 'pasta', 'azucar', 'sal', 'harina',
  'vinagre', 'mayonesa', 'ketchup', 'chocolate', 'miel', 'garbanzos', 'lentejas',
  'pizza congelada', 'helado', 'patatas fritas', 'frutos secos',
  'detergente', 'papel higienico', 'bolsas basura', 'lavavajillas', 'suavizante',
  'champu', 'gel', 'pasta dentifrica', 'desodorante', 'toallitas', 'panales',
  'pienso perro', 'pienso gato',
];

interface DiaPrices {
  currency?: string;
  discount_percentage?: number | null;
  is_club_price?: boolean;
  is_promo_price?: boolean;
  measure_unit?: string | null;
  price?: number | string | null;
  price_per_unit?: number | string | null;
  strikethrough_price?: number | string | null;
}

interface DiaProduct {
  object_id?: string;
  sku_id?: string;
  display_name?: string;
  brand?: string | null;
  brand_type?: string;
  dia_brand?: boolean;
  image?: string | null;
  l1_category_description?: string;
  l2_category_description?: string;
  prices?: DiaPrices;
  units_in_stock?: number;
  url?: string;
}

interface DiaPagination {
  page_number?: number;
  page_size?: number;
  total_pages?: number;
}

interface DiaResponse {
  search_items?: DiaProduct[];
  pagination?: DiaPagination;
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
        let page = 1;
        let totalPages = 1;
        do {
          const data = await this.search(query, page);
          if (!data) break;
          totalPages = Math.min(
            data.pagination?.total_pages ?? 1,
            MAX_PAGES_PER_QUERY,
          );
          const raws = data.search_items ?? [];
          for (const raw of raws) {
            const id = this.resolveId(raw);
            if (!id || seen.has(id)) continue;
            const normalized = this.normalize(raw, id);
            if (!normalized) continue;
            seen.add(id);
            products.push(normalized);
          }
          page += 1;
        } while (page <= totalPages);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`DIA query "${query}" falhou: ${msg}`);
      }
    }

    this.logger.log(`DIA: ${products.length} produtos coletados`);
    return products;
  }

  private async search(query: string, page: number): Promise<DiaResponse | null> {
    const url = `${BASE_URL}?q=${encodeURIComponent(query)}&page=${page}`;
    try {
      return await politeFetch<DiaResponse>(url, {
        userAgent: pickUserAgent(),
        referer: 'https://www.dia.es/',
        accept: 'application/json, text/plain, */*',
        minJitterMs: 2000,
        maxJitterMs: 5000,
        maxRetries: 4,
        initialBackoffMs: 3000,
        minWaitOnBlockMs: 20_000,
        onRetry: (attempt, status) => {
          this.logger.warn(
            `DIA retry ${attempt} (status=${status ?? 'network'}) query=${query} page=${page}`,
          );
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`DIA fetch "${query}" p${page} falhou: ${msg}`);
      return null;
    }
  }

  private resolveId(raw: DiaProduct): string | null {
    const id = raw.object_id ?? raw.sku_id;
    return id != null && id !== '' ? String(id) : null;
  }

  private normalize(raw: DiaProduct, id: string): RawProduct | null {
    const name = raw.display_name;
    if (!name) return null;

    const priceRaw = raw.prices?.price;
    if (priceRaw == null) return null;
    const price = typeof priceRaw === 'string' ? parseFloat(priceRaw) : Number(priceRaw);
    if (!Number.isFinite(price) || price <= 0) return null;

    const strike = raw.prices?.strikethrough_price;
    const strikeValue =
      strike == null || strike === ''
        ? null
        : typeof strike === 'string'
          ? parseFloat(strike)
          : Number(strike);
    const isPromo =
      raw.prices?.is_promo_price === true ||
      (raw.prices?.discount_percentage != null &&
        Number(raw.prices.discount_percentage) > 0);
    const previousPrice =
      isPromo && strikeValue != null && Number.isFinite(strikeValue) && strikeValue > price
        ? strikeValue
        : null;

    const { packageSize, packageUnit, comparisonUnit } = this.parsePackage(
      raw.prices?.measure_unit,
      name,
    );

    const imageUrl = this.resolveImage(raw.image);
    const categoryHint =
      raw.l2_category_description || raw.l1_category_description || null;

    return {
      externalId: id,
      name,
      brand: raw.brand ?? null,
      ean: null,
      categoryHint,
      imageUrl,
      packageSize,
      packageUnit,
      comparisonUnit,
      price: Math.round(price * 100) / 100,
      onPromotion: isPromo,
      previousPrice,
      isAvailable: (raw.units_in_stock ?? 0) > 0,
    };
  }

  private resolveImage(image: string | null | undefined): string | null {
    if (!image) return null;
    if (image.startsWith('http://') || image.startsWith('https://')) return image;
    if (image.startsWith('/')) return `${IMAGE_HOST}${image}`;
    return `${IMAGE_HOST}/${image}`;
  }

  /**
   * DIA `measure_unit` é a BASE DE COMPARAÇÃO do price_per_unit, não a
   * unidade de pacote. Ex: "Queso 250g" vem com measure_unit=KILO (price_per_unit
   * = preço por kg). Package size real vem do display_name regex.
   */
  private parsePackage(
    measureUnit: string | null | undefined,
    name: string,
  ): {
    packageSize: number;
    packageUnit: RawPackageUnit;
    comparisonUnit: RawPackageUnit;
  } {
    const comparisonUnit = this.mapComparisonUnit(measureUnit);
    const extracted = this.extractPackageFromName(name);
    const packageUnit = extracted.unit ?? comparisonUnit;
    const packageSize = extracted.size > 0 ? extracted.size : 1;
    return { packageSize, packageUnit, comparisonUnit };
  }

  private mapComparisonUnit(unit: string | null | undefined): RawPackageUnit {
    const u = (unit || '').toUpperCase();
    if (u.includes('LITRO') || /\bML\b/.test(u)) return 'LITER';
    if (u.includes('KILO') || u.includes('GRAMO')) return 'KILOGRAM';
    return 'UNIT';
  }

  private extractPackageFromName(name: string): {
    size: number;
    unit: RawPackageUnit | null;
  } {
    // Prioriza "pack N x Y <unit>" → total = N*Y <unit>
    const packMatch = name.match(
      /pack\s*(\d+)\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)\s*(l|ml|kg|g|gr)/i,
    );
    if (packMatch) {
      const count = parseInt(packMatch[1], 10);
      const each = parseFloat(packMatch[2].replace(',', '.'));
      const unitStr = packMatch[3].toLowerCase();
      const unit = this.unitFromToken(unitStr);
      if (count > 0 && Number.isFinite(each) && each > 0 && unit) {
        return { size: Math.round(count * each * 1000) / 1000, unit };
      }
    }
    // "250 g", "1 L", "500 ml"
    const match = name.match(/(\d+(?:[.,]\d+)?)\s*(l|ml|kg|g|gr)\b/i);
    if (match) {
      const value = parseFloat(match[1].replace(',', '.'));
      const unit = this.unitFromToken(match[2].toLowerCase());
      if (Number.isFinite(value) && value > 0 && unit) {
        return { size: value, unit };
      }
    }
    return { size: 1, unit: null };
  }

  private unitFromToken(token: string): RawPackageUnit | null {
    switch (token.toLowerCase()) {
      case 'l':
        return 'LITER';
      case 'ml':
        return 'MILLILITER';
      case 'kg':
        return 'KILOGRAM';
      case 'g':
      case 'gr':
        return 'GRAM';
      default:
        return null;
    }
  }
}
