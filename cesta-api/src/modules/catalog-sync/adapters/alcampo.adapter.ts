import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { politeFetchRaw } from '../utils/polite-fetch';
import { pickUserAgent } from '../utils/user-agents';
import { scrapingbeeFetch } from '../utils/scrapingbee-fetch';
import type {
  RawPackageUnit,
  RawProduct,
  SupermarketAdapter,
} from './supermarket-adapter.interface';

// Alcampo (compraonline.alcampo.es) — S123 AWS WAF jsapi.js challenge bloqueia
// raw fetch. S128 Puppeteer funcionou mas OOM Render 512MB. S134 pivot pra
// ScrapingBee (ADR 0009 opção A).
//
// Estratégia:
//  1. Sitemap via politeFetchRaw (não protegido WAF): extrai produto URLs
//     /products/<slug>/<id> do sitemap-products-part*.xml
//  2. Para N páginas de produto: scrapingbeeFetch renderiza JS challenge
//     → extrai JSON-LD Product schema → mapeia pra RawProduct
//  3. Rate limit: 2s inter-page (ScrapingBee latência ~5-20s já serializa)
const SITEMAP_INDEX = 'https://compraonline.alcampo.es/sitemaps/sitemap_index.xml';
const MAX_PRODUCTS = 120;

@Injectable()
export class AlcampoAdapter implements SupermarketAdapter {
  readonly slug = 'alcampo';
  private readonly logger = new Logger(AlcampoAdapter.name);
  private readonly ua = pickUserAgent();

  async fetchProducts(): Promise<RawProduct[]> {
    const urls = await this.loadProductUrls();
    if (urls.length === 0) {
      this.logger.warn('Alcampo: 0 product URLs no sitemap');
      return [];
    }
    const slice = urls.slice(0, MAX_PRODUCTS);
    const seen = new Set<string>();
    const products: RawProduct[] = [];
    const errors: string[] = [];

    for (const url of slice) {
      try {
        const raw = await this.fetchProductPage(url);
        if (!raw) continue;
        if (seen.has(raw.externalId)) continue;
        seen.add(raw.externalId);
        products.push(raw);
        await new Promise((r) => setTimeout(r, 2000));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Alcampo page "${url}" falhou: ${msg}`);
        errors.push(msg);
      }
    }

    // Sprint 134-r P2: se todas pages falharem (0 produtos), bubble up último
    // erro pra service persistir em SyncRun.errorMessage.
    if (products.length === 0 && errors.length > 0) {
      throw new Error(
        `Alcampo: 0 produtos coletados em ${slice.length} pages · últimos erros: ${errors.slice(-3).join(' | ')}`,
      );
    }

    this.logger.log(
      `Alcampo: ${products.length} produtos coletados (${slice.length - errors.length}/${slice.length} pages ok via ScrapingBee)`,
    );
    return products;
  }

  private async loadProductUrls(): Promise<string[]> {
    const index = await this.fetchXml(SITEMAP_INDEX);
    if (!index) return [];
    const nested = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const productSitemaps = nested.filter((u) =>
      /sitemap-products(-part\d+)?\.xml/.test(u),
    );
    const urls: string[] = [];
    for (const sm of productSitemaps.slice(0, 2)) {
      const xml = await this.fetchXml(sm);
      if (!xml) continue;
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      urls.push(...locs);
    }
    return urls;
  }

  private async fetchXml(url: string): Promise<string | null> {
    try {
      const result = await politeFetchRaw<string>(url, {
        userAgent: this.ua,
        accept: 'application/xml, text/xml',
        minJitterMs: 500,
        maxJitterMs: 1500,
      });
      if (result.status !== 200 || typeof result.body !== 'string') {
        return null;
      }
      return result.body;
    } catch {
      return null;
    }
  }

  private async fetchProductPage(url: string): Promise<RawProduct | null> {
    const result = await scrapingbeeFetch(url, {
      renderJs: true,
      waitFor: 'script[type="application/ld+json"]',
      timeoutMs: 45_000,
    });
    if (!result.html) return null;
    return this.extractProduct(result.html, url);
  }

  private extractProduct(html: string, url: string): RawProduct | null {
    const $ = cheerio.load(html);
    const scripts = $('script[type="application/ld+json"]').toArray();
    for (const script of scripts) {
      try {
        const json = JSON.parse($(script).text());
        const product = this.findProductSchema(json);
        if (product) return this.normalizeSchema(product, url);
      } catch {
        continue;
      }
    }
    return null;
  }

  private findProductSchema(obj: unknown): Record<string, unknown> | null {
    if (!obj || typeof obj !== 'object') return null;
    const asArr = Array.isArray(obj) ? obj : [obj];
    for (const entry of asArr) {
      if (entry && typeof entry === 'object') {
        const rec = entry as Record<string, unknown>;
        if (rec['@type'] === 'Product') return rec;
        const graph = rec['@graph'];
        if (Array.isArray(graph)) {
          const found = this.findProductSchema(graph);
          if (found) return found;
        }
      }
    }
    return null;
  }

  private normalizeSchema(
    product: Record<string, unknown>,
    url: string,
  ): RawProduct | null {
    const name = this.asString(product.name);
    if (!name) return null;

    const sku = this.asString(product.sku);
    const idFromUrl = this.extractIdFromUrl(url);
    const externalId = sku ?? idFromUrl;
    if (!externalId) return null;

    const brand = this.asString(
      (product.brand as Record<string, unknown>)?.name ?? product.brand,
    );
    const ean = this.asString(product.gtin13 ?? product.gtin ?? product.gtin8);
    const imageUrl = this.extractImage(product.image);

    const offers = this.asOfferArray(product.offers);
    const offer = offers[0];
    if (!offer) return null;
    const priceRaw = offer.price ?? offer.lowPrice;
    const price =
      typeof priceRaw === 'string' ? parseFloat(priceRaw) : Number(priceRaw);
    if (!Number.isFinite(price) || price <= 0) return null;

    const { packageSize, packageUnit, comparisonUnit } = this.extractPackage(name);
    const availability = this.asString(offer.availability) ?? '';
    const isAvailable = availability.includes('InStock');

    return {
      externalId,
      name,
      brand: brand ?? null,
      ean: ean ?? null,
      categoryHint: this.asString(product.category) ?? null,
      imageUrl,
      packageSize,
      packageUnit,
      comparisonUnit,
      price: Math.round(price * 100) / 100,
      onPromotion: false,
      previousPrice: null,
      isAvailable: availability === '' ? true : isAvailable,
    };
  }

  private asString(v: unknown): string | null {
    if (typeof v === 'string') return v.trim() || null;
    if (typeof v === 'number') return String(v);
    return null;
  }

  private asOfferArray(v: unknown): Array<Record<string, unknown>> {
    if (!v) return [];
    if (Array.isArray(v)) return v as Array<Record<string, unknown>>;
    if (typeof v === 'object') return [v as Record<string, unknown>];
    return [];
  }

  private extractImage(v: unknown): string | null {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (Array.isArray(v) && v.length > 0) {
      const first = v[0];
      return typeof first === 'string' ? first : null;
    }
    if (typeof v === 'object') {
      const url = (v as Record<string, unknown>).url;
      return typeof url === 'string' ? url : null;
    }
    return null;
  }

  private extractIdFromUrl(url: string): string | null {
    const m = url.match(/\/products\/[^/]+\/(\d+)/);
    return m ? m[1] : null;
  }

  private extractPackage(name: string): {
    packageSize: number;
    packageUnit: RawPackageUnit;
    comparisonUnit: RawPackageUnit;
  } {
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
}
