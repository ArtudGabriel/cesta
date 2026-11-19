import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { politeFetchRaw } from '../utils/polite-fetch';
import { pickUserAgent } from '../utils/user-agents';
import type {
  RawPackageUnit,
  RawProduct,
  SupermarketAdapter,
} from './supermarket-adapter.interface';

// Aldi (www.aldi.es) — descoberto em S127 via probe:
//   GET /es/ofertas.html → 200 HTML ~1.3MB, 192 product-tiles SSR
// Páginas /producto/<slug>-<id>.html carregam preço via JS AEM (não SSR)
// → full catálogo 2939 produtos exige Puppeteer (backlog). Ofertas.html é
// único endpoint com tiles + preço SSR.
//
// Tile shape (data-testid):
//   product-tile container
//   product-name (h2)
//   brand-name (p)
//   tag-current-price-amount (span)
//   tag-cross-price-label > span (preço anterior)
//   tag-sales-unit ("4 kg unidad" → packageSize + unit)
//   tag-base-price ("kg = 0.95" → comparison basis)
//   a href="https://www.aldi.es/producto/<slug>-<id>.html" (product URL)
//   img src="https://s7g10.scene7.com/is/image/aldinord/<id>_...?wid=1440" (imagem)
const OFERTAS_URL = 'https://www.aldi.es/es/ofertas.html';
const PRODUCT_URL_RE = /\/producto\/[\w\-áéíóúüñ]+-(\d+)\.html/i;

interface AldiTile {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  previousPrice: number | null;
  onPromotion: boolean;
  imageUrl: string | null;
  packageSize: number;
  packageUnit: RawPackageUnit;
  comparisonUnit: RawPackageUnit;
}

@Injectable()
export class AldiAdapter implements SupermarketAdapter {
  readonly slug = 'aldi';
  private readonly logger = new Logger(AldiAdapter.name);
  private readonly ua = pickUserAgent();

  async fetchProducts(): Promise<RawProduct[]> {
    const html = await this.fetchHtml(OFERTAS_URL);
    if (!html) {
      this.logger.warn('Aldi: ofertas.html indisponível');
      return [];
    }
    const tiles = this.extractTiles(html);
    const products: RawProduct[] = tiles.map((t) => ({
      externalId: t.id,
      name: t.name,
      brand: t.brand,
      ean: null,
      categoryHint: null,
      imageUrl: t.imageUrl,
      packageSize: t.packageSize,
      packageUnit: t.packageUnit,
      comparisonUnit: t.comparisonUnit,
      price: Math.round(t.price * 100) / 100,
      onPromotion: t.onPromotion,
      previousPrice: t.previousPrice,
      isAvailable: true,
    }));
    this.logger.log(`Aldi: ${products.length} produtos coletados (ofertas.html SSR)`);
    return products;
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

  private extractTiles(html: string): AldiTile[] {
    const $ = cheerio.load(html);
    const out: AldiTile[] = [];
    $('.product-tile').each((_, el) => {
      const tile = $(el);
      const linkHref =
        tile.find('a.product-tile__action[href]').attr('href') ||
        tile.find('a[data-testid^="product-tile-grid-product-tile"]').attr('href') ||
        '';
      const urlMatch = linkHref.match(PRODUCT_URL_RE);
      if (!urlMatch) return;
      const id = urlMatch[1];

      const name = tile.find('[data-testid="product-name"]').first().text().trim();
      if (!name) return;

      const priceText = tile
        .find('[data-testid="tag-current-price-amount"]')
        .first()
        .text()
        .trim();
      const price = parseFloat(priceText.replace(',', '.'));
      if (!Number.isFinite(price) || price <= 0) return;

      const prevText = tile
        .find('[data-testid="tag-cross-price-label"] span')
        .first()
        .text()
        .trim();
      const prevParsed = prevText ? parseFloat(prevText.replace(',', '.')) : NaN;
      const previousPrice =
        Number.isFinite(prevParsed) && prevParsed > price ? prevParsed : null;
      const promoText = tile
        .find('[data-testid="tag-promo-label"]')
        .first()
        .text()
        .trim();
      const onPromotion =
        previousPrice !== null || (promoText.length > 0 && promoText !== '0%');

      const brandRaw = tile
        .find('[data-testid="brand-name"]')
        .first()
        .text()
        .trim();
      const brand = brandRaw.length > 0 ? brandRaw : null;

      const imageUrl = this.extractImage(tile.find('img').first(), $);

      const salesUnit = tile
        .find('[data-testid="tag-sales-unit"]')
        .first()
        .text()
        .trim();
      const { packageSize, packageUnit, comparisonUnit } = this.parsePackage(
        salesUnit,
        name,
      );

      out.push({
        id,
        name,
        brand,
        price,
        previousPrice,
        onPromotion,
        imageUrl,
        packageSize,
        packageUnit,
        comparisonUnit,
      });
    });
    return out;
  }

  private extractImage(
    img: ReturnType<cheerio.CheerioAPI>,
    _$: cheerio.CheerioAPI,
  ): string | null {
    const src = img.attr('src');
    if (src && src.startsWith('http')) return src;
    const srcSet = img.attr('srcset') || img.attr('srcSet');
    if (srcSet) {
      // Format: "url1 360w, url2 768w, url3 1024w, url4 1440w"
      const parts = srcSet.split(',').map((p) => p.trim().split(/\s+/)[0]);
      const last = parts.filter((p) => p.startsWith('http')).pop();
      if (last) return last;
    }
    return null;
  }

  /**
   * salesUnit samples:
   *   "4 kg unidad"   → 4 KG
   *   "500 g unidad"  → 500 G
   *   "1 L unidad"    → 1 L
   *   "pack 6 x 330 ml" (edge)
   * Fallback: extract from name.
   */
  private parsePackage(
    salesUnit: string,
    name: string,
  ): {
    packageSize: number;
    packageUnit: RawPackageUnit;
    comparisonUnit: RawPackageUnit;
  } {
    const source = salesUnit || name;
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
