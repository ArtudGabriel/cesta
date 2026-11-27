import { AldiAdapter } from './aldi.adapter';
import { politeFetchRaw } from '../utils/polite-fetch';

jest.mock('../utils/polite-fetch', () => {
  const actual = jest.requireActual('../utils/polite-fetch');
  return {
    ...actual,
    politeFetchRaw: jest.fn(),
  };
});
jest.mock('../utils/user-agents', () => ({ pickUserAgent: () => 'test-ua' }));

const mockedPoliteFetchRaw = politeFetchRaw as jest.MockedFunction<typeof politeFetchRaw>;

const SITEMAP_URL =
  'https://www.aldi.es/sitemaps/.aldi-nord-sitemap-products.xml';
const OFERTAS_URL = 'https://www.aldi.es/es/ofertas.html';

function sitemapXml(productSlugs: Array<{ slug: string; id: string }>): string {
  const urls = productSlugs
    .map(
      (p) =>
        `<url><loc>https://www.aldi.es/producto/${p.slug}-${p.id}.html</loc></url>`,
    )
    .join('');
  // include a non-product URL to assert filter
  return `<?xml version="1.0" encoding="UTF-8"?><urlset>${urls}<url><loc>https://www.aldi.es/tiendas.html</loc></url></urlset>`;
}

function detailHtml(opts: {
  id: string;
  name: string;
  brand?: string;
  price: number | string;
  image?: string;
  description?: string;
  omitProductBlock?: boolean;
  omitJsonLd?: boolean;
  invalidJsonLd?: boolean;
  gtin13?: string | number;
  gtin12?: string | number;
  gtin?: string | number;
  gtin8?: string | number;
}): string {
  if (opts.omitJsonLd) {
    return `<html><body><h1>${opts.name}</h1></body></html>`;
  }
  if (opts.invalidJsonLd) {
    return `<html><body><script type="application/ld+json">{not json</script></body></html>`;
  }
  const productPayload: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: opts.name,
    image: opts.image
      ? [opts.image]
      : [`https://s7g10.scene7.com/is/image/aldinord/${opts.id}_pack`],
    description: opts.description ?? '',
    sku: opts.id,
    brand: opts.brand ? { '@type': 'Brand', name: opts.brand } : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: opts.price,
      availability: 'https://schema.org/InStock',
    },
  };
  if (opts.gtin13 !== undefined) productPayload.gtin13 = opts.gtin13;
  if (opts.gtin12 !== undefined) productPayload.gtin12 = opts.gtin12;
  if (opts.gtin !== undefined) productPayload.gtin = opts.gtin;
  if (opts.gtin8 !== undefined) productPayload.gtin8 = opts.gtin8;
  const productBlock = opts.omitProductBlock
    ? `<script type="application/ld+json">${JSON.stringify({ '@type': 'BreadcrumbList', itemListElement: [] })}</script>`
    : `<script type="application/ld+json">${JSON.stringify(productPayload)}</script>`;
  return `<html><body>${productBlock}</body></html>`;
}

function ofertasHtml(
  tiles: Array<{
    id: string;
    slug: string;
    price: string;
    prevPrice?: string;
    promoLabel?: string;
  }>,
): string {
  return `<html><body>${tiles
    .map(
      (t) => `
      <div class="product-tile">
        <a class="product-tile__action" href="https://www.aldi.es/producto/${t.slug}-${t.id}.html">${t.slug}</a>
        ${t.promoLabel ? `<span data-testid="tag-promo-label">${t.promoLabel}</span>` : ''}
        <span data-testid="tag-current-price-amount">${t.price}</span>
        ${t.prevPrice ? `<span data-testid="tag-cross-price-label"><span>${t.prevPrice}</span></span>` : ''}
      </div>`,
    )
    .join('')}</body></html>`;
}

/**
 * Mock global.fetch (used by bareFetch for sitemap) distinct from
 * politeFetchRaw (ofertas + detail pages).
 */
function installGlobalFetch(sitemap: string | null) {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === SITEMAP_URL) {
      if (sitemap === null) {
        return { ok: false, status: 500, text: async () => '' } as any;
      }
      return { ok: true, status: 200, text: async () => sitemap } as any;
    }
    return { ok: false, status: 404, text: async () => '' } as any;
  }) as any;
  return () => {
    global.fetch = originalFetch;
  };
}

function wireDetailAndOfertas(
  responses: Record<string, string>,
  ofertas: string | null,
) {
  mockedPoliteFetchRaw.mockImplementation(async (url) => {
    if (url === OFERTAS_URL) {
      if (ofertas === null) return { body: '', status: 503, setCookie: [] } as any;
      return { body: ofertas, status: 200, setCookie: [] } as any;
    }
    const detail = responses[url];
    if (!detail) return { body: '', status: 404, setCookie: [] } as any;
    return { body: detail, status: 200, setCookie: [] } as any;
  });
}

describe('AldiAdapter S219 sitemap+JSON-LD', () => {
  let adapter: AldiAdapter;
  let restoreFetch: () => void;

  beforeEach(() => {
    adapter = new AldiAdapter();
    mockedPoliteFetchRaw.mockReset();
  });

  afterEach(() => {
    restoreFetch?.();
    delete process.env.ALDI_MAX_PRODUCTS;
  });

  it('crawl sitemap → fetch cada detail → extrai JSON-LD Product.offers.price', async () => {
    const sitemap = sitemapXml([
      { slug: 'cerveza-clasica', id: '50600' },
      { slug: 'leche-entera', id: '123456' },
    ]);
    restoreFetch = installGlobalFetch(sitemap);
    wireDetailAndOfertas(
      {
        'https://www.aldi.es/producto/cerveza-clasica-50600.html': detailHtml({
          id: '50600',
          name: 'Cerveza clásica',
          brand: 'KARLSQUELL',
          price: 0.29,
          description: '500 ml lata',
        }),
        'https://www.aldi.es/producto/leche-entera-123456.html': detailHtml({
          id: '123456',
          name: 'Leche entera',
          brand: 'Milsani',
          price: 0.89,
          description: '1 L brick',
        }),
      },
      ofertasHtml([]),
    );

    const products = await adapter.fetchProducts();
    expect(products).toHaveLength(2);
    const byId = new Map(products.map((p) => [p.externalId, p]));
    expect(byId.get('50600')).toMatchObject({
      externalId: '50600',
      name: 'Cerveza clásica',
      brand: 'KARLSQUELL',
      price: 0.29,
      onPromotion: false,
      previousPrice: null,
      packageUnit: 'MILLILITER',
      packageSize: 500,
    });
    expect(byId.get('123456')).toMatchObject({
      externalId: '123456',
      brand: 'Milsani',
      price: 0.89,
      packageUnit: 'LITER',
      packageSize: 1,
    });
  });

  it('overlay ofertas.html marca onPromotion + previousPrice + sobrescreve preço com tile', async () => {
    const sitemap = sitemapXml([{ slug: 'naranja', id: '600575300' }]);
    restoreFetch = installGlobalFetch(sitemap);
    wireDetailAndOfertas(
      {
        'https://www.aldi.es/producto/naranja-600575300.html': detailHtml({
          id: '600575300',
          name: 'Naranja',
          price: 4.85,
          description: '4 kg unidad',
        }),
      },
      ofertasHtml([
        {
          slug: 'naranja',
          id: '600575300',
          price: '3.79',
          prevPrice: '4.85',
          promoLabel: '-21%',
        },
      ]),
    );

    const products = await adapter.fetchProducts();
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      externalId: '600575300',
      price: 3.79,
      previousPrice: 4.85,
      onPromotion: true,
      packageUnit: 'KILOGRAM',
      packageSize: 4,
    });
  });

  it('respeita ALDI_MAX_PRODUCTS cap', async () => {
    process.env.ALDI_MAX_PRODUCTS = '1';
    const sitemap = sitemapXml([
      { slug: 'a', id: '1' },
      { slug: 'b', id: '2' },
      { slug: 'c', id: '3' },
    ]);
    restoreFetch = installGlobalFetch(sitemap);
    wireDetailAndOfertas(
      {
        'https://www.aldi.es/producto/a-1.html': detailHtml({
          id: '1',
          name: 'A',
          price: 1.0,
        }),
        'https://www.aldi.es/producto/b-2.html': detailHtml({
          id: '2',
          name: 'B',
          price: 2.0,
        }),
        'https://www.aldi.es/producto/c-3.html': detailHtml({
          id: '3',
          name: 'C',
          price: 3.0,
        }),
      },
      ofertasHtml([]),
    );

    const products = await adapter.fetchProducts();
    expect(products).toHaveLength(1);
    expect(products[0].externalId).toBe('1');
  });

  it('dropouts: pula detail sem JSON-LD Product block, price inválido, fetch fail', async () => {
    const sitemap = sitemapXml([
      { slug: 'ok', id: '100' },
      { slug: 'nojsonld', id: '200' },
      { slug: 'noproduct', id: '300' },
      { slug: 'noprice', id: '400' },
      { slug: 'fetchfail', id: '500' },
    ]);
    restoreFetch = installGlobalFetch(sitemap);
    wireDetailAndOfertas(
      {
        'https://www.aldi.es/producto/ok-100.html': detailHtml({
          id: '100',
          name: 'OK',
          price: 1.5,
        }),
        'https://www.aldi.es/producto/nojsonld-200.html': detailHtml({
          id: '200',
          name: 'NoJsonLd',
          price: 1.5,
          omitJsonLd: true,
        }),
        'https://www.aldi.es/producto/noproduct-300.html': detailHtml({
          id: '300',
          name: 'NoProduct',
          price: 1.5,
          omitProductBlock: true,
        }),
        'https://www.aldi.es/producto/noprice-400.html': detailHtml({
          id: '400',
          name: 'NoPrice',
          price: 0,
        }),
        // fetchfail-500 intentionally missing → mock returns 404
      },
      ofertasHtml([]),
    );

    const products = await adapter.fetchProducts();
    expect(products).toHaveLength(1);
    expect(products[0].externalId).toBe('100');
  });

  it('sitemap vazio ou fetch fail → [] sem throw', async () => {
    restoreFetch = installGlobalFetch(null);
    mockedPoliteFetchRaw.mockResolvedValue({
      body: '',
      status: 200,
      setCookie: [],
    } as any);
    const products = await adapter.fetchProducts();
    expect(products).toEqual([]);
  });

  // ────────────────────────────────────────────────────────────
  // Sprint 228 G1 (ADR 0036) — EAN/GTIN extraction do JSON-LD
  // ────────────────────────────────────────────────────────────

  it('S228 G1: extrai gtin13 do JSON-LD → ean populado (EAN-13 europeu padrão Aldi)', async () => {
    const sitemap = sitemapXml([{ slug: 'cerveza-clasica', id: '50600' }]);
    restoreFetch = installGlobalFetch(sitemap);
    wireDetailAndOfertas(
      {
        'https://www.aldi.es/producto/cerveza-clasica-50600.html': detailHtml({
          id: '50600',
          name: 'Cerveza clásica',
          brand: 'KARLSQUELL',
          price: 0.29,
          description: '500 ml lata',
          gtin13: '4061458000013',
        }),
      },
      ofertasHtml([]),
    );
    const products = await adapter.fetchProducts();
    expect(products).toHaveLength(1);
    expect(products[0].ean).toBe('4061458000013');
  });

  it('S228 G1: fallback cadeia gtin13 → gtin12 → gtin → gtin8 (não nulos)', async () => {
    const sitemap = sitemapXml([
      { slug: 'a', id: '1' },
      { slug: 'b', id: '2' },
      { slug: 'c', id: '3' },
      { slug: 'd', id: '4' },
    ]);
    restoreFetch = installGlobalFetch(sitemap);
    wireDetailAndOfertas(
      {
        'https://www.aldi.es/producto/a-1.html': detailHtml({
          id: '1',
          name: 'A',
          price: 1.0,
          gtin12: '123456789012',
        }),
        'https://www.aldi.es/producto/b-2.html': detailHtml({
          id: '2',
          name: 'B',
          price: 1.0,
          gtin: '7891234567',
        }),
        'https://www.aldi.es/producto/c-3.html': detailHtml({
          id: '3',
          name: 'C',
          price: 1.0,
          gtin8: '12345670',
        }),
        'https://www.aldi.es/producto/d-4.html': detailHtml({
          id: '4',
          name: 'D',
          price: 1.0,
          // sem GTIN → ean null
        }),
      },
      ofertasHtml([]),
    );
    const products = await adapter.fetchProducts();
    const byId = new Map(products.map((p) => [p.externalId, p]));
    expect(byId.get('1')?.ean).toBe('123456789012');
    expect(byId.get('2')?.ean).toBe('7891234567');
    expect(byId.get('3')?.ean).toBe('12345670');
    expect(byId.get('4')?.ean).toBeNull();
  });

  it('S228 G1: gtin13 prioridade sobre gtin12/gtin/gtin8 quando múltiplos presentes', async () => {
    const sitemap = sitemapXml([{ slug: 'all', id: '99' }]);
    restoreFetch = installGlobalFetch(sitemap);
    wireDetailAndOfertas(
      {
        'https://www.aldi.es/producto/all-99.html': detailHtml({
          id: '99',
          name: 'All GTIN',
          price: 1.0,
          gtin13: '4061458000013',
          gtin12: '123456789012',
          gtin: '7891234567',
          gtin8: '12345670',
        }),
      },
      ofertasHtml([]),
    );
    const products = await adapter.fetchProducts();
    expect(products[0].ean).toBe('4061458000013');
  });

  it('S228 G1: gtin numérico JSON (não string) convertido → ean string', async () => {
    const sitemap = sitemapXml([{ slug: 'num', id: '42' }]);
    restoreFetch = installGlobalFetch(sitemap);
    wireDetailAndOfertas(
      {
        'https://www.aldi.es/producto/num-42.html': detailHtml({
          id: '42',
          name: 'Numeric',
          price: 1.0,
          gtin13: 4061458000013,
        }),
      },
      ofertasHtml([]),
    );
    const products = await adapter.fetchProducts();
    expect(products[0].ean).toBe('4061458000013');
  });

  it('ofertas.html indisponível → produtos ainda extraídos sem overlay', async () => {
    const sitemap = sitemapXml([{ slug: 'x', id: '999' }]);
    restoreFetch = installGlobalFetch(sitemap);
    wireDetailAndOfertas(
      {
        'https://www.aldi.es/producto/x-999.html': detailHtml({
          id: '999',
          name: 'X',
          price: 2.5,
        }),
      },
      null,
    );
    const products = await adapter.fetchProducts();
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      externalId: '999',
      price: 2.5,
      onPromotion: false,
      previousPrice: null,
    });
  });
});
