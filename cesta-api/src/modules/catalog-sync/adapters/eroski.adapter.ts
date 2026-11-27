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
// Sprint 220: cap default 60 → 300. Audit sitemap live 2026-11-27 revelou
// 1317 folhas lvl3+ reais. Cap 60 limitava ceiling a ~900 produtos; DB prod
// estava em 746 (~85% coverage do cap). Cap 300 destrava ceiling teórico
// ~4500 produtos (300 × avg 15 tiles/leaf). Remoção total do cap deixada
// pra sprint seguinte quando empírico validar rate-limit Eroski + tempo.
const DEFAULT_MAX_CATEGORIES = 300;
// Sprint 220: filter sitemap folhas >= 3 segmentos (filtro antigo era >= 2,
// que pegava 1613 URLs mas ~296 delas eram hubs lvl2 sem SSR de tiles —
// produziam ruído e inflaram dropout categoryNoTiles). Live probe confirmou
// que tiles reais aparecem só a partir de lvl 3 do breadcrumb Eroski.
const MIN_CATEGORY_SEGMENTS = 3;

function resolveMaxCategories(): number {
  const raw = process.env.EROSKI_MAX_CATEGORIES;
  if (!raw) return DEFAULT_MAX_CATEGORIES;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_CATEGORIES;
}

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

interface EroskiDropouts {
  sitemapEmpty: number;
  categoryFetchFail: number;
  categoryNoTiles: number;
  tileParseFail: number;
  tileNoItem: number;
  tileNoId: number;
  tileNoName: number;
  tileBadPrice: number;
  tileDuplicate: number;
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
    // Sprint 220: observability por dropout cause (paridade Mercadona S217 /
    // Aldi S219). Expõe por que tiles não viraram produto final — permite
    // debugar yield baixo sem pedir shell prod.
    const dropouts: EroskiDropouts = {
      sitemapEmpty: 0,
      categoryFetchFail: 0,
      categoryNoTiles: 0,
      tileParseFail: 0,
      tileNoItem: 0,
      tileNoId: 0,
      tileNoName: 0,
      tileBadPrice: 0,
      tileDuplicate: 0,
    };

    const categoryUrls = await this.loadCategoryUrls();
    if (categoryUrls.length === 0) {
      dropouts.sitemapEmpty = 1;
      throw new Error(
        'Eroski: 0 categorias no sitemap — CDN block ou sitemap vazio (ver logs loadCategoryUrls)',
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
          dropouts.categoryFetchFail += 1;
          errors.push(`${url}: fetchHtml null (CDN block ou timeout)`);
          continue;
        }
        fetchedCategories += 1;
        const extracted = this.extractFromCategory(html, url, dropouts, seen);
        if (extracted.rawTiles === 0) {
          dropouts.categoryNoTiles += 1;
        }
        for (const raw of extracted.products) {
          products.push(raw);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Eroski category "${url}" falhou: ${msg}`);
        errors.push(`${url}: ${msg}`);
      }
    }

    // Sprint 137: bubble up quando TODAS categorias falham (0 produtos +
    // erros registrados). Previne silent-failure do S125 (prod retornava
    // [] silencioso; QA/SyncRun.errorMessage ficava null). Mesma política
    // Carrefour/Alcampo (PR #86 S134-r).
    if (products.length === 0 && errors.length > 0) {
      throw new Error(
        `Eroski: 0 produtos em ${slice.length} categorias · últimos erros: ${errors.slice(-3).join(' | ')}`,
      );
    }

    this.logger.log(
      `Eroski: ${products.length} produtos coletados (${fetchedCategories}/${slice.length} categorias ok) · dropouts fetch=${dropouts.categoryFetchFail} notiles=${dropouts.categoryNoTiles} parse=${dropouts.tileParseFail} noitem=${dropouts.tileNoItem} noid=${dropouts.tileNoId} noname=${dropouts.tileNoName} badprice=${dropouts.tileBadPrice} dup=${dropouts.tileDuplicate}`,
    );
    return products;
  }

  private async loadCategoryUrls(): Promise<string[]> {
    // Sprint 125: prod log S124 revelou "0 categorias no sitemap" apesar
    // probe dev local retornar 1819 <loc>. Diagnóstico: politeFetchRaw envia
    // Sec-Fetch-Site=same-origin + Accept-Encoding=gzip,deflate,br + outros
    // headers XHR-like que Eroski CDN pode rejeitar silenciosamente de IPs
    // datacenter (Render us-east). Usamos bareFetch bare-bones (UA + Accept)
    // pra mimetizar browser direto. Fallback: parse robots.txt Sitemap:
    // directive se sitemap.xml vazio/falhar.
    let xml = await this.bareFetch(SITEMAP_URL, 'application/xml, text/xml');
    let source = SITEMAP_URL;
    if (!xml || !xml.includes('<loc>')) {
      this.logger.warn(
        `Eroski sitemap.xml inválido (len=${xml?.length ?? 0}, preview="${(xml ?? '').slice(0, 200).replace(/\s+/g, ' ')}"), tentando fallback robots.txt`,
      );
      const robots = await this.bareFetch(`${ROOT}/robots.txt`, 'text/plain');
      if (robots) {
        const m = robots.match(/^Sitemap:\s*(\S+)/im);
        if (m && m[1] !== SITEMAP_URL) {
          source = m[1];
          this.logger.log(`Eroski fallback sitemap: ${source}`);
          xml = await this.bareFetch(source, 'application/xml, text/xml');
        }
      }
    }
    if (!xml) {
      this.logger.warn('Eroski: sitemap body null após fallback');
      return [];
    }

    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    this.logger.log(
      `Eroski sitemap source=${source} xmlLen=${xml.length} totalLocs=${locs.length}`,
    );
    // Categorias folha têm padrão /es/supermercado/<id>-<slug>/<id>-<slug>/.../
    // Sprint 220: filtro >= MIN_CATEGORY_SEGMENTS (3). Lvl2 hubs raramente
    // SSR-rendem tiles; audit scripts/audit-eroski-adapter.mjs confirmou
    // folhas reais só a partir de lvl3 (1317 URLs vs 1613 com filtro >=2).
    const filtered = locs.filter((u) => {
      if (!u.includes(CATEGORY_PATH_PREFIX)) return false;
      const tail = u.split(CATEGORY_PATH_PREFIX)[1] || '';
      const segments = tail.split('/').filter(Boolean);
      return segments.length >= MIN_CATEGORY_SEGMENTS;
    });
    this.logger.log(`Eroski categorias folha (lvl>=${MIN_CATEGORY_SEGMENTS}): ${filtered.length}`);
    return filtered;
  }

  /**
   * Fetch minimalista pra sitemap/robots.txt — só UA + Accept. politeFetchRaw
   * default manda Sec-Fetch-* + Accept-Encoding que Eroski CDN pode filtrar
   * de IPs datacenter.
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
        this.logger.warn(`Eroski bareFetch ${url} status=${response.status}`);
        return null;
      }
      const text = await response.text();
      return text;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Eroski bareFetch ${url} erro: ${msg}`);
      return null;
    }
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

  private extractFromCategory(
    html: string,
    categoryUrl: string,
    dropouts: EroskiDropouts,
    seen: Set<string>,
  ): { products: RawProduct[]; rawTiles: number } {
    const $ = cheerio.load(html);
    const products: RawProduct[] = [];
    let rawTiles = 0;
    $('.product-title-link[data-metrics]').each((_, el) => {
      rawTiles += 1;
      const metricsAttr = $(el).attr('data-metrics');
      if (!metricsAttr) {
        dropouts.tileParseFail += 1;
        return;
      }
      let parsed: DataMetrics | null = null;
      try {
        parsed = JSON.parse(this.decodeHtmlEntities(metricsAttr)) as DataMetrics;
      } catch {
        dropouts.tileParseFail += 1;
        return;
      }
      const item = parsed.ecommerce?.items?.[0];
      if (!item) {
        dropouts.tileNoItem += 1;
        return;
      }
      const result = this.normalizeOrReason(item, categoryUrl);
      if (result.product) {
        if (seen.has(result.product.externalId)) {
          dropouts.tileDuplicate += 1;
          return;
        }
        seen.add(result.product.externalId);
        products.push(result.product);
      } else {
        switch (result.cause) {
          case 'no-id':
            dropouts.tileNoId += 1;
            break;
          case 'no-name':
            dropouts.tileNoName += 1;
            break;
          case 'bad-price':
            dropouts.tileBadPrice += 1;
            break;
        }
      }
    });
    return { products, rawTiles };
  }

  private normalizeOrReason(
    item: DataMetricsItem,
    categoryUrl: string,
  ): {
    product: RawProduct | null;
    cause?: 'no-id' | 'no-name' | 'bad-price';
  } {
    const id = item.item_id != null ? String(item.item_id) : null;
    if (!id) return { product: null, cause: 'no-id' };
    const name = item.item_name;
    if (!name) return { product: null, cause: 'no-name' };

    const priceRaw = item.price;
    if (priceRaw == null) return { product: null, cause: 'bad-price' };
    const price =
      typeof priceRaw === 'string' ? parseFloat(priceRaw) : Number(priceRaw);
    if (!Number.isFinite(price) || price <= 0) {
      return { product: null, cause: 'bad-price' };
    }

    const { packageSize, packageUnit, comparisonUnit } =
      this.extractPackage(name);
    const imageUrl = `${ROOT}/images/${id}.jpg`;
    const categoryHint = this.categoryHintFromUrl(categoryUrl);
    const brandRaw = item.item_brand ? item.item_brand.replace(/\.$/, '') : null;

    return {
      product: {
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
      },
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
