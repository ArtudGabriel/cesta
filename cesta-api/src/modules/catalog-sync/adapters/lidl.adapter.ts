import { Injectable, Logger } from '@nestjs/common';
import { politeFetchRaw } from '../utils/polite-fetch';
import { pickUserAgent } from '../utils/user-agents';
import type {
  RawPackageUnit,
  RawProduct,
  SupermarketAdapter,
} from './supermarket-adapter.interface';

// LIDL (www.lidl.es) — descoberto em S126 via probe live:
//   GET /q/search?q=<query>&type=json
// Response: HTML 1.5MB com array de produtos JSON (HTML-encoded) inline.
// Cada produto tem shape:
//   { erpNumber, fullTitle, image, keyfacts.analyticsCategory,
//     price: { price: <number>, displayedCurrency: "€" }, productType, ... }
// Não há sitemap de produtos — scan via SEED_QUERIES (~40 queries × ~96 produtos
// cada = ~3800 potenciais).
//
// LIDL NÃO tem anti-bot aparente. Headers XHR-like passam de IPs datacenter
// (ao contrário de Eroski S125 — contratos CDN diferentes).
const BASE_URL = 'https://www.lidl.es/q/search';
const MAX_QUERIES = 40;

const SEED_QUERIES = [
  'leche', 'yogur', 'queso', 'huevos', 'mantequilla',
  'pan', 'cereales', 'galletas', 'bolleria',
  'pollo', 'carne', 'jamon', 'chorizo', 'embutido',
  'salmon', 'atun', 'merluza', 'pescado',
  'platano', 'tomate', 'patata', 'manzana', 'naranja', 'lechuga',
  'agua', 'zumo', 'refresco', 'cerveza', 'vino',
  'aceite', 'arroz', 'pasta', 'azucar', 'sal', 'harina',
  'pizza', 'helado', 'congelado',
  'detergente', 'papel', 'champu', 'gel', 'pasta dentifrica',
];

@Injectable()
export class LidlAdapter implements SupermarketAdapter {
  readonly slug = 'lidl';
  private readonly logger = new Logger(LidlAdapter.name);
  private readonly ua = pickUserAgent();

  async fetchProducts(): Promise<RawProduct[]> {
    const seen = new Set<string>();
    const products: RawProduct[] = [];
    const queries = SEED_QUERIES.slice(0, MAX_QUERIES);

    for (const query of queries) {
      try {
        const html = await this.fetchSearchHtml(query);
        if (!html) continue;
        const items = this.extractProducts(html);
        for (const item of items) {
          if (seen.has(item.externalId)) continue;
          seen.add(item.externalId);
          products.push(item);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`LIDL query "${query}" falhou: ${msg}`);
      }
    }

    this.logger.log(
      `LIDL: ${products.length} produtos coletados (${queries.length} queries)`,
    );
    return products;
  }

  private async fetchSearchHtml(query: string): Promise<string | null> {
    const url = `${BASE_URL}?q=${encodeURIComponent(query)}&type=json`;
    try {
      const result = await politeFetchRaw<string>(url, {
        userAgent: this.ua,
        referer: 'https://www.lidl.es/',
        accept: 'text/html,application/xhtml+xml',
        minJitterMs: 2000,
        maxJitterMs: 5000,
      });
      if (result.status !== 200 || typeof result.body !== 'string') {
        this.logger.warn(`LIDL fetch "${query}" status=${result.status}`);
        return null;
      }
      return result.body;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`LIDL fetch "${query}" erro: ${msg}`);
      return null;
    }
  }

  /**
   * HTML contém produtos como JSON HTML-encoded (&quot; etc) inline no
   * script data. Fragmento de cada produto delimitado pela próxima aparição
   * de `erpNumber` OU fim do array. Decodamos entities por segmento e
   * extraímos campos via regex (JSON shape estável).
   */
  private extractProducts(html: string): RawProduct[] {
    const out: RawProduct[] = [];
    const anchors: number[] = [];
    const anchorRegex = /&quot;erpNumber&quot;:&quot;\d+&quot;/g;
    let m: RegExpExecArray | null;
    while ((m = anchorRegex.exec(html)) !== null) {
      anchors.push(m.index);
    }
    for (let i = 0; i < anchors.length; i += 1) {
      const start = anchors[i];
      const end = i + 1 < anchors.length ? anchors[i + 1] : start + 8000;
      const segment = this.decodeHtmlEntities(html.slice(start, end));
      const parsed = this.parseSegment(segment);
      if (parsed) out.push(parsed);
    }
    return out;
  }

  private parseSegment(segment: string): RawProduct | null {
    const idMatch = segment.match(/"erpNumber":"(\d+)"/);
    if (!idMatch) return null;
    const externalId = idMatch[1];

    const titleMatch = segment.match(/"fullTitle":"((?:[^"\\]|\\.)*)"/);
    if (!titleMatch) return null;
    const name = this.unescapeJson(titleMatch[1]);
    if (!name) return null;

    // S186: regex precisa atravessar sub-objetos (e.g. "packaging":{}, "discount":{...},
    // "specialTaxes":[]) que agora aparecem dentro do objeto price entre a abertura
    // "price":{ e o campo price numérico interno. Antes usava [^}]*? que falhava no
    // primeiro } de "packaging":{}, zerando o yield prod (0/48 por query).
    const priceMatch = segment.match(/"price":\{[\s\S]{0,2000}?"price":(\d+(?:\.\d+)?)/);
    if (!priceMatch) return null;
    const price = Number(priceMatch[1]);
    if (!Number.isFinite(price) || price <= 0) return null;

    const imageMatch = segment.match(/"image":"((?:[^"\\]|\\.)*)"/);
    const imageUrl = imageMatch ? this.unescapeJson(imageMatch[1]) : null;

    const brandMatch = segment.match(/"brand":"((?:[^"\\]|\\.)*)"/);
    const brandField = brandMatch ? this.unescapeJson(brandMatch[1]) : null;

    const categoryMatch = segment.match(
      /"analyticsCategory":"((?:[^"\\]|\\.)*)"/,
    );
    const categoryHint = categoryMatch
      ? this.lastCategorySegment(this.unescapeJson(categoryMatch[1]))
      : null;

    const { packageSize, packageUnit, comparisonUnit } =
      this.extractPackage(name);

    return {
      externalId,
      name,
      brand: brandField && brandField.length > 0 ? brandField : this.brandFromTitle(name),
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

  private brandFromTitle(name: string): string | null {
    // LIDL usa brands como "SILVERCREST®" ou "FIN CARRÉ" no início do título,
    // seguidas por descrição Capitalized (letra 1 maiúscula + resto minúsc).
    // Capturamos 1-3 palavras ALL-CAPS consecutivas (incluindo ® & -).
    const m = name.match(
      /^([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ®&\-]{1,}(?:\s[A-ZÁÉÍÓÚÜÑ®&\-]{2,}){0,2})(?:\s|$)/,
    );
    return m ? m[1].replace(/®$/, '').trim() : null;
  }

  private lastCategorySegment(path: string): string | null {
    const parts = path.split('/').filter((p) => p.trim().length > 0);
    return parts.length > 0 ? parts[parts.length - 1] : null;
  }

  private decodeHtmlEntities(s: string): string {
    return s
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ');
  }

  private unescapeJson(s: string): string {
    return s
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\\//g, '/');
  }
}
