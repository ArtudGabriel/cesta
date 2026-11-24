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

// Froiz (supermercado.froiz.com) — Nuxt SSR app com sitemap público.
// Sprint 141: impl real substitui stub do S7. Pattern Eroski (S124/S125):
// sitemap via bareFetch (CDN pode filtrar Sec-Fetch headers XHR-like
// de IP datacenter), categoria HTML via politeFetchRaw com jitter.
// 7099 produtos + 557 categorias leaf (depth=3) no sitemap; adapter
// fatia primeiros N via FROIZ_MAX_CATEGORIES env.
//
// Pipeline:
//  1. bareFetch sitemap.xml → 8280 <loc> entries (produtos + cats).
//  2. Filtra categorias depth 3 e 4 (leaf = tem produtos).
//  3. Pra cada categoria: politeFetchRaw → Cheerio → `.product` cards.
//  4. Extrai name + current/previous price + offer flag + image.
//  5. Normalized match pelo nome (sem EAN público).
const BASE = 'https://supermercado.froiz.com';
const SITEMAP_URL = `${BASE}/sitemap.xml`;
const DEFAULT_MAX_CATEGORIES = 60;
const LEAF_DEPTHS = new Set([3, 4]);

function resolveMaxCategories(): number {
  const raw = process.env.FROIZ_MAX_CATEGORIES;
  if (!raw) return DEFAULT_MAX_CATEGORIES;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_CATEGORIES;
}

@Injectable()
export class FroizAdapter implements SupermarketAdapter {
  readonly slug = 'froiz';
  readonly definition: SupermarketDefinition = {
    slug: 'froiz',
    name: 'Froiz',
    color: '#4BA82E',
  };
  private readonly logger = new Logger(FroizAdapter.name);
  private readonly ua = pickUserAgent();

  async fetchProducts(): Promise<RawProduct[]> {
    const categoryUrls = await this.loadCategoryUrls();
    if (categoryUrls.length === 0) {
      throw new Error(
        'Froiz: 0 categorias no sitemap — CDN block ou sitemap vazio (ver logs loadCategoryUrls)',
      );
    }

    const seen = new Set<string>();
    const products: RawProduct[] = [];
    const slice = categoryUrls.slice(0, resolveMaxCategories());
    const errors: string[] = [];
    let fetchedCategories = 0;

    for (const url of slice) {
      try {
        const html = await this.fetchHtml(url);
        if (!html) {
          errors.push(`${url}: fetchHtml null (CDN block ou timeout)`);
          continue;
        }
        fetchedCategories += 1;
        const raws = this.extractFromCategory(html);
        for (const raw of raws) {
          if (seen.has(raw.externalId)) continue;
          seen.add(raw.externalId);
          products.push(raw);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Froiz category "${url}" falhou: ${msg}`);
        errors.push(`${url}: ${msg}`);
      }
    }

    if (products.length === 0 && errors.length > 0) {
      throw new Error(
        `Froiz: 0 produtos em ${slice.length} categorias · últimos erros: ${errors.slice(-3).join(' | ')}`,
      );
    }

    this.logger.log(
      `Froiz: ${products.length} produtos coletados (${fetchedCategories}/${slice.length} categorias ok)`,
    );
    return products;
  }

  private async loadCategoryUrls(): Promise<string[]> {
    const xml = await this.bareFetch(SITEMAP_URL, 'application/xml, text/xml');
    if (!xml) {
      this.logger.warn('Froiz: sitemap body null');
      return [];
    }
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const cats = locs.filter((u) => !u.includes('/product/'));
    const filtered = cats.filter((u) => {
      try {
        const path = new URL(u).pathname;
        const depth = path.split('/').filter(Boolean).length;
        return LEAF_DEPTHS.has(depth);
      } catch {
        return false;
      }
    });
    this.logger.log(
      `Froiz sitemap xmlLen=${xml.length} totalLocs=${locs.length} categoriasLeaf=${filtered.length}`,
    );
    return filtered;
  }

  /**
   * Fetch minimalista pra sitemap — só UA + Accept. Alguns CDNs filtram
   * requests datacenter com Sec-Fetch-* headers XHR-like default do
   * politeFetchRaw.
   */
  private async bareFetch(url: string, accept: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.ua,
          Accept: accept,
          'Accept-Language': 'es-ES,es;q=0.9',
        },
      });
      if (!response.ok) {
        this.logger.warn(`Froiz bareFetch ${url} status=${response.status}`);
        return null;
      }
      return await response.text();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Froiz bareFetch ${url} erro: ${msg}`);
      return null;
    }
  }

  private async fetchHtml(url: string): Promise<string | null> {
    try {
      const result = await politeFetchRaw<string>(url, {
        userAgent: this.ua,
        referer: `${BASE}/`,
        accept: 'text/html,application/xhtml+xml',
        minJitterMs: 1000,
        maxJitterMs: 3000,
      });
      if (result.status !== 200 || typeof result.body !== 'string') {
        this.logger.warn(`Froiz fetch ${url} status=${result.status}`);
        return null;
      }
      return result.body;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Froiz fetch ${url} erro: ${msg}`);
      return null;
    }
  }

  private extractFromCategory(html: string): RawProduct[] {
    const $ = cheerio.load(html);
    const out: RawProduct[] = [];
    $('.product-grid .product').each((_, el) => {
      const card = $(el);
      const name = card.find('.name').last().text().trim();
      if (!name) return;
      const priceSpans = card
        .find('.price span')
        .toArray()
        .map((e) => this.parsePrice($(e).text()))
        .filter((v): v is number => v != null);
      const onPromotion = card.find('.offer').text().trim().length > 0;

      let current: number | null = null;
      let previous: number | null = null;
      if (priceSpans.length === 0) return;
      if (onPromotion && priceSpans.length >= 2) {
        // em promoção: [previous, current]
        previous = priceSpans[0];
        current = priceSpans[1];
      } else {
        current = priceSpans[0];
      }
      if (current == null || !Number.isFinite(current) || current <= 0) return;

      const img = card.find('img').attr('src') ?? null;
      const { packageSize, packageUnit, comparisonUnit } =
        this.parsePackage(name);
      const externalId = this.normalizeId(name);
      if (!externalId) return;

      out.push({
        externalId,
        name,
        brand: null,
        ean: null,
        categoryHint: null,
        imageUrl: img,
        packageSize,
        packageUnit,
        comparisonUnit,
        price: Math.round(current * 100) / 100,
        onPromotion,
        previousPrice:
          previous != null && Number.isFinite(previous) ? previous : null,
        isAvailable: true,
      });
    });
    return out;
  }

  private parsePrice(text: string): number | null {
    // "1,49 €" OR "1,49&nbsp;€" (NBSP já decodificado pela Cheerio).
    const m = text.replace(/ /g, ' ').match(/(\d+(?:[.,]\d+)?)\s*€/);
    if (!m) return null;
    const v = parseFloat(m[1].replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  private parsePackage(name: string): {
    packageSize: number;
    packageUnit: RawPackageUnit;
    comparisonUnit: RawPackageUnit;
  } {
    // Multi-pack: "pack 3", "3x100 g"
    const packMatch = name.match(
      /(\d+)\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)\s*(l|ml|kg|g|gr)\b/i,
    );
    if (packMatch) {
      const count = parseInt(packMatch[1], 10);
      const each = parseFloat(packMatch[2].replace(',', '.'));
      const unit = this.unitFromToken(packMatch[3]);
      if (count > 0 && Number.isFinite(each) && each > 0 && unit) {
        return {
          packageSize: Math.round(count * each * 1000) / 1000,
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

  /** Sem EAN e sem product-id estável no DOM. ID derivado do nome
   * (normalizado) pra dedup dentro do run. Match com Product no DB
   * acontece via normalizedName no CatalogSyncService (S116). */
  private normalizeId(name: string): string | null {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug.length > 0 ? slug : null;
  }
}
