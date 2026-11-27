import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { politeFetchRaw } from '../utils/polite-fetch';
import { pickUserAgent } from '../utils/user-agents';
import type {
  RawPackageUnit,
  RawProduct,
  SupermarketAdapter,
} from './supermarket-adapter.interface';

// Aldi (www.aldi.es) — adapter rewrite S219 (ADR 0028).
//
// Pre-S219: scrape único de /es/ofertas.html → 192 tiles SSR. Ceiling fixo,
// DB ~145 (85% coverage da promo page, resto não vem SSR). S127 assumiu que
// páginas de produto exigiam Puppeteer (price via JS AEM).
//
// S219 probe revelou: cada /producto/<slug>-<id>.html carrega JSON-LD
// (type=Product) SSR com offers.price + brand + sku + image. Plus sitemap
// /sitemaps/.aldi-nord-sitemap-products.xml lista 2966 URLs de produto.
//
// Novo pattern: sitemap discovery + per-URL JSON-LD detail fetch + overlay
// ofertas.html para onPromotion/previousPrice (promo-only metadata).
//
// Cap: ALDI_MAX_PRODUCTS (default 300) — rollout incremental respeita polite
// rate (politeFetchRaw ~2-5s jitter). 300 produtos ≈ 10-25min por sync.
// Remover cap em sprint seguinte quando empírico confirmar estabilidade.
const SITEMAP_URL = 'https://www.aldi.es/sitemaps/.aldi-nord-sitemap-products.xml';
const OFERTAS_URL = 'https://www.aldi.es/es/ofertas.html';
const PRODUCT_URL_RE = /\/producto\/[\w\-áéíóúüñ]+-(\d+)\.html/i;
const DEFAULT_MAX_PRODUCTS = 300;

interface AldiOfertaOverlay {
  onPromotion: boolean;
  previousPrice: number | null;
  tilePrice: number | null;
}

interface AldiJsonLdProduct {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  imageUrl: string | null;
  description: string | null;
}

@Injectable()
export class AldiAdapter implements SupermarketAdapter {
  readonly slug = 'aldi';
  private readonly logger = new Logger(AldiAdapter.name);
  private readonly ua = pickUserAgent();

  async fetchProducts(): Promise<RawProduct[]> {
    const dropouts = {
      sitemapEmpty: 0,
      detailFetchFail: 0,
      detailNoJsonLd: 0,
      detailNoProductBlock: 0,
      detailNoPrice: 0,
      detailBadId: 0,
    };

    const urls = await this.loadSitemapUrls();
    if (urls.length === 0) {
      dropouts.sitemapEmpty = 1;
      this.logger.warn('Aldi: sitemap vazio ou indisponível');
      return [];
    }

    const cap = this.readMaxProducts();
    const slice = urls.slice(0, cap);
    this.logger.log(
      `Aldi: sitemap ${urls.length} URLs · processando ${slice.length} (cap=${cap})`,
    );

    const overlay = await this.loadOfertasOverlay();
    this.logger.log(`Aldi: overlay ofertas ${overlay.size} tiles`);

    const products: RawProduct[] = [];
    for (const url of slice) {
      const idFromUrl = url.match(PRODUCT_URL_RE)?.[1] ?? null;
      if (!idFromUrl) {
        dropouts.detailBadId += 1;
        continue;
      }

      const detail = await this.fetchDetail(url);
      if (detail === 'fetch-fail') {
        dropouts.detailFetchFail += 1;
        continue;
      }
      if (detail === 'no-jsonld') {
        dropouts.detailNoJsonLd += 1;
        continue;
      }
      if (detail === 'no-product-block') {
        dropouts.detailNoProductBlock += 1;
        continue;
      }
      if (detail === 'no-price') {
        dropouts.detailNoPrice += 1;
        continue;
      }

      const over = overlay.get(detail.id);
      const onPromotion = over?.onPromotion ?? false;
      const previousPrice = over?.previousPrice ?? null;
      const price = over?.tilePrice ?? detail.price;

      const pkg = this.parsePackage(detail.name, detail.description);
      products.push({
        externalId: detail.id,
        name: detail.name,
        brand: detail.brand,
        ean: null,
        categoryHint: null,
        imageUrl: detail.imageUrl,
        packageSize: pkg.packageSize,
        packageUnit: pkg.packageUnit,
        comparisonUnit: pkg.comparisonUnit,
        price: Math.round(price * 100) / 100,
        onPromotion,
        previousPrice,
        isAvailable: true,
      });
    }

    this.logger.log(
      `Aldi: ${products.length} produtos coletados · dropouts fetch=${dropouts.detailFetchFail} nojsonld=${dropouts.detailNoJsonLd} noproduct=${dropouts.detailNoProductBlock} noprice=${dropouts.detailNoPrice} badid=${dropouts.detailBadId}`,
    );
    return products;
  }

  private readMaxProducts(): number {
    const raw = process.env.ALDI_MAX_PRODUCTS;
    if (!raw) return DEFAULT_MAX_PRODUCTS;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_PRODUCTS;
    return n;
  }

  private async loadSitemapUrls(): Promise<string[]> {
    const xml = await this.bareFetch(SITEMAP_URL, 'application/xml, text/xml');
    if (!xml || !xml.includes('<loc>')) {
      this.logger.warn(`Aldi sitemap inválido (len=${xml?.length ?? 0})`);
      return [];
    }
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1])
      .filter((u) => /\/producto\/[^?#]+-\d+\.html$/i.test(u));
    return locs;
  }

  private async loadOfertasOverlay(): Promise<Map<string, AldiOfertaOverlay>> {
    const html = await this.fetchHtml(OFERTAS_URL);
    const overlay = new Map<string, AldiOfertaOverlay>();
    if (!html) {
      this.logger.warn('Aldi: ofertas.html indisponível (overlay vazio)');
      return overlay;
    }
    const $ = cheerio.load(html);
    $('.product-tile').each((_, el) => {
      const tile = $(el);
      const linkHref =
        tile.find('a.product-tile__action[href]').attr('href') ||
        tile.find('a[data-testid^="product-tile-grid-product-tile"]').attr('href') ||
        '';
      const id = linkHref.match(PRODUCT_URL_RE)?.[1];
      if (!id) return;

      const priceText = tile
        .find('[data-testid="tag-current-price-amount"]')
        .first()
        .text()
        .trim();
      const price = parseFloat(priceText.replace(',', '.'));
      const tilePrice = Number.isFinite(price) && price > 0 ? price : null;

      const prevText = tile
        .find('[data-testid="tag-cross-price-label"] span')
        .first()
        .text()
        .trim();
      const prevParsed = prevText ? parseFloat(prevText.replace(',', '.')) : NaN;
      const previousPrice =
        Number.isFinite(prevParsed) && tilePrice !== null && prevParsed > tilePrice
          ? prevParsed
          : null;

      const promoText = tile
        .find('[data-testid="tag-promo-label"]')
        .first()
        .text()
        .trim();
      const onPromotion =
        previousPrice !== null || (promoText.length > 0 && promoText !== '0%');

      overlay.set(id, { onPromotion, previousPrice, tilePrice });
    });
    return overlay;
  }

  private async fetchDetail(
    url: string,
  ): Promise<
    | AldiJsonLdProduct
    | 'fetch-fail'
    | 'no-jsonld'
    | 'no-product-block'
    | 'no-price'
  > {
    const html = await this.fetchHtml(url);
    if (!html) return 'fetch-fail';

    const blocks = [
      ...html.matchAll(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
      ),
    ].map((m) => m[1]);
    if (blocks.length === 0) return 'no-jsonld';

    let product: any = null;
    for (const raw of blocks) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed['@type'] === 'Product') {
          product = parsed;
          break;
        }
      } catch {
        // skip malformed block
      }
    }
    if (!product) return 'no-product-block';

    const price = Number(product.offers?.price);
    if (!Number.isFinite(price) || price <= 0) return 'no-price';

    const id = url.match(PRODUCT_URL_RE)?.[1] ?? String(product.sku ?? '');
    if (!id) return 'no-price';

    const brandRaw =
      typeof product.brand === 'string'
        ? product.brand
        : (product.brand?.name ?? null);
    const brand = brandRaw && String(brandRaw).trim().length > 0 ? String(brandRaw).trim() : null;

    const imageRaw = Array.isArray(product.image) ? product.image[0] : product.image;
    const imageUrl =
      typeof imageRaw === 'string' && imageRaw.startsWith('http') ? imageRaw : null;

    const name = String(product.name ?? '').trim();
    const description =
      typeof product.description === 'string' ? product.description : null;

    if (!name) return 'no-price';

    return { id, name, brand, price, imageUrl, description };
  }

  private async fetchHtml(url: string): Promise<string | null> {
    try {
      const result = await politeFetchRaw<string>(url, {
        userAgent: this.ua,
        referer: 'https://www.aldi.es/',
        accept: 'text/html,application/xhtml+xml',
        minJitterMs: 1000,
        maxJitterMs: 3000,
      });
      if (result.status !== 200 || typeof result.body !== 'string') {
        this.logger.warn(`Aldi fetch ${url} status=${result.status}`);
        return null;
      }
      return result.body;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Aldi fetch ${url} erro: ${msg}`);
      return null;
    }
  }

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
        this.logger.warn(`Aldi bareFetch ${url} status=${response.status}`);
        return null;
      }
      return await response.text();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Aldi bareFetch ${url} erro: ${msg}`);
      return null;
    }
  }

  private parsePackage(
    name: string,
    description: string | null,
  ): {
    packageSize: number;
    packageUnit: RawPackageUnit;
    comparisonUnit: RawPackageUnit;
  } {
    const source = `${name} ${description ?? ''}`;
    const packMatch = source.match(
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
    const single = source.match(/(\d+(?:[.,]\d+)?)\s*(l|ml|kg|g|gr)\b/i);
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
