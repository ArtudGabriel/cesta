import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { politeFetchRaw } from '../utils/polite-fetch';
import { pickUserAgent } from '../utils/user-agents';
import type {
  RawPackageUnit,
  RawProduct,
  SupermarketAdapter,
  SupermarketDefinition,
} from './supermarket-adapter.interface';

// Eroski (supermercado.eroski.es) — descoberto em S124 via probe. Site
// SSR-rendered: category pages retornam HTML completo com ecommerce JSON
// embutido em `data-metrics` attribute dos links `.product-title-link`.
// Pattern:
//   1. Fetch sitemap.xml → lista 1800+ URLs (categorias + estáticas)
//   2. Filtrar URLs /supermercado/.../...-slug/ (categorias folha)
//   3. Fetch cada categoria → Cheerio → extrai data-metrics ecommerce items
//   4. Mapeia pra RawProduct (price, item_name, item_id, item_brand, images)
//
// Sem anti-bot aparente (sem WAF/JS challenge). polite-fetch jitter + UA pool
// mantém educado. No EAN público; match via normalizedName (S116 auto-create).
const ROOT = 'https://supermercado.eroski.es';
const SITEMAP_URL = `${ROOT}/sitemap.xml`;
const CATEGORY_PATH_PREFIX = '/es/supermercado/';
const MAX_CATEGORIES = 60;

interface DataMetricsItem {
  price?: number | string;
  item_name?: string;
  item_id?: string | number;
  item_brand?: string;
  item_category?: string;
  item_category2?: string;
  item_category3?: string;
  item_variant?: string;
  index?: number;
  quantity?: number;
}

interface DataMetrics {
  event?: string;
  ecommerce?: {
    currency?: string;
    items?: DataMetricsItem[];
  };
}

@Injectable()
export class EroskiAdapter implements SupermarketAdapter {
  readonly slug = 'eroski';
  readonly definition: SupermarketDefinition = {
    slug: 'eroski',
    name: 'Eroski',
    color: '#E30613',
  };
  private readonly logger = new Logger(EroskiAdapter.name);
  private readonly ua = pickUserAgent();

  async fetchProducts(): Promise<RawProduct[]> {
    const categoryUrls = await this.loadCategoryUrls();
    if (categoryUrls.length === 0) {
      this.logger.warn('Eroski: 0 categorias no sitemap');
      return [];
    }

    const seen = new Set<string>();
    const products: RawProduct[] = [];
    const slice = categoryUrls.slice(0, MAX_CATEGORIES);

    for (const url of slice) {
      try {
        const html = await this.fetchHtml(url);
        if (!html) continue;
        const raws = this.extractFromCategory(html, url);
        for (const raw of raws) {
          if (seen.has(raw.externalId)) continue;
          seen.add(raw.externalId);
          products.push(raw);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Eroski category "${url}" falhou: ${msg}`);
      }
    }

    this.logger.log(
      `Eroski: ${products.length} produtos coletados (${slice.length} categorias)`,
    );
    return products;
  }

  private async loadCategoryUrls(): Promise<string[]> {
    const html = await this.fetchHtml(SITEMAP_URL, 'application/xml');
    if (!html) return [];
    const locs = [...html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    // Categorias folha têm padrão /es/supermercado/<id>-<slug>/<id>-<slug>/<id>-<slug>/
    // Filtra URLs com pelo menos 3 segmentos após supermercado.
    return locs.filter((u) => {
      if (!u.includes(CATEGORY_PATH_PREFIX)) return false;
      const tail = u.split(CATEGORY_PATH_PREFIX)[1] || '';
      const segments = tail.split('/').filter(Boolean);
      return segments.length >= 2;
    });
  }

  private async fetchHtml(
    url: string,
    accept?: string,
  ): Promise<string | null> {
    try {
      const result = await politeFetchRaw<string>(url, {
        userAgent: this.ua,
        referer: ROOT + '/',
        accept: accept || 'text/html,application/xhtml+xml',
        minJitterMs: 1000,
        maxJitterMs: 3000,
      });
      if (result.status !== 200 || typeof result.body !== 'string') {
        this.logger.warn(`Eroski fetch ${url} status=${result.status}`);
        return null;
      }
      return result.body;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Eroski fetch ${url} erro: ${msg}`);
      return null;
    }
  }

  private extractFromCategory(html: string, categoryUrl: string): RawProduct[] {
    const $ = cheerio.load(html);
    const out: RawProduct[] = [];
    $('.product-title-link[data-metrics]').each((_, el) => {
      const metricsAttr = $(el).attr('data-metrics');
      if (!metricsAttr) return;
      let parsed: DataMetrics | null = null;
      try {
        parsed = JSON.parse(this.decodeHtmlEntities(metricsAttr)) as DataMetrics;
      } catch {
        return;
      }
      const item = parsed.ecommerce?.items?.[0];
      if (!item) return;
      const normalized = this.normalize(item, categoryUrl);
      if (normalized) out.push(normalized);
    });
    return out;
  }

  private normalize(
    item: DataMetricsItem,
    categoryUrl: string,
  ): RawProduct | null {
    const id = item.item_id != null ? String(item.item_id) : null;
    if (!id) return null;
    const name = item.item_name;
    if (!name) return null;

    const priceRaw = item.price;
    if (priceRaw == null) return null;
    const price =
      typeof priceRaw === 'string' ? parseFloat(priceRaw) : Number(priceRaw);
    if (!Number.isFinite(price) || price <= 0) return null;

    const { packageSize, packageUnit, comparisonUnit } =
      this.extractPackage(name);
    const imageUrl = `${ROOT}/images/${id}.jpg`;
    const categoryHint = this.categoryHintFromUrl(categoryUrl);
    const brandRaw = item.item_brand ? item.item_brand.replace(/\.$/, '') : null;

    return {
      externalId: id,
      name,
      brand: brandRaw && brandRaw.length > 0 ? brandRaw : null,
      ean: null,
      categoryHint,
      imageUrl,
      packageSize,
      packageUnit,
      comparisonUnit,
      price: Math.round(price * 100) / 100,
      onPromotion: false,
      previousPrice: null,
      isAvailable: true,
    };
  }

  private categoryHintFromUrl(url: string): string | null {
    const tail = url.split(CATEGORY_PATH_PREFIX)[1] || '';
    const segments = tail.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || null;
    if (!last) return null;
    // "2059700-naranjas-y-otros-citricos" → "naranjas y otros citricos"
    const m = last.match(/^\d+-(.+)$/);
    return m ? m[1].replace(/-/g, ' ') : last.replace(/-/g, ' ');
  }

  private extractPackage(name: string): {
    packageSize: number;
    packageUnit: RawPackageUnit;
    comparisonUnit: RawPackageUnit;
  } {
    const packMatch = name.match(
      /pack[\s-]*(\d+)\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)\s*(l|ml|kg|g|gr)\b/i,
    );
    if (packMatch) {
      const count = parseInt(packMatch[1], 10);
      const each = parseFloat(packMatch[2].replace(',', '.'));
      const unit = this.unitFromToken(packMatch[3]);
      if (count > 0 && Number.isFinite(each) && each > 0 && unit) {
        const size = Math.round(count * each * 1000) / 1000;
        return {
          packageSize: size,
          packageUnit: unit,
          comparisonUnit: this.toComparison(unit),
        };
      }
    }
    const single = name.match(/(\d+(?:[.,]\d+)?)\s*(l|ml|kg|g|gr)\b/i);
    if (single) {
      const value = parseFloat(single[1].replace(',', '.'));
      const unit = this.unitFromToken(single[2]);
      if (Number.isFinite(value) && value > 0 && unit) {
        return {
          packageSize: value,
          packageUnit: unit,
          comparisonUnit: this.toComparison(unit),
        };
      }
    }
    return { packageSize: 1, packageUnit: 'UNIT', comparisonUnit: 'UNIT' };
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

  private toComparison(unit: RawPackageUnit): RawPackageUnit {
    if (unit === 'LITER' || unit === 'MILLILITER') return 'LITER';
    if (unit === 'KILOGRAM' || unit === 'GRAM') return 'KILOGRAM';
    return 'UNIT';
  }

  /** data-metrics vem com HTML entities escapadas (&quot; etc). */
  private decodeHtmlEntities(s: string): string {
    return s
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ');
  }
}
