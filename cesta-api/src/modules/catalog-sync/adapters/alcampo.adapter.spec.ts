import { AlcampoAdapter } from './alcampo.adapter';
import { politeFetchRaw } from '../utils/polite-fetch';
import { puppeteerFetch, closePuppeteerBrowser } from '../utils/puppeteer-fetch';

jest.mock('../utils/polite-fetch', () => {
  const actual = jest.requireActual('../utils/polite-fetch');
  return {
    ...actual,
    politeFetchRaw: jest.fn(),
  };
});
jest.mock('../utils/puppeteer-fetch', () => ({
  puppeteerFetch: jest.fn(),
  closePuppeteerBrowser: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../utils/user-agents', () => ({ pickUserAgent: () => 'test-ua' }));

const mockedPoliteFetchRaw = politeFetchRaw as jest.MockedFunction<typeof politeFetchRaw>;
const mockedPuppeteer = puppeteerFetch as jest.MockedFunction<typeof puppeteerFetch>;
const mockedClose = closePuppeteerBrowser as jest.MockedFunction<typeof closePuppeteerBrowser>;

const SITEMAP_INDEX_XML = `<?xml version="1.0"?><sitemapindex>
  <sitemap><loc>https://www.compraonline.alcampo.es/sitemaps/sitemap-products-part1.xml</loc></sitemap>
  <sitemap><loc>https://www.compraonline.alcampo.es/sitemaps/sitemap-categories-part1.xml</loc></sitemap>
</sitemapindex>`;

const SITEMAP_PRODUCTS_XML = `<?xml version="1.0"?><urlset>
  <url><loc>https://www.compraonline.alcampo.es/products/auchan-leche-entera-1-l/54178</loc></url>
  <url><loc>https://www.compraonline.alcampo.es/products/pascual-leche-1l/50733</loc></url>
</urlset>`;

const productLd = (overrides: Record<string, unknown>) => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Leche entera 1 L',
  sku: 'SKU-54178',
  brand: { '@type': 'Brand', name: 'Auchan' },
  gtin13: '8410000000013',
  image: 'https://img.alcampo.es/54178.jpg',
  category: 'Lácteos',
  offers: {
    '@type': 'Offer',
    price: 0.99,
    availability: 'https://schema.org/InStock',
  },
  ...overrides,
});

const htmlWithLd = (ld: unknown) =>
  `<html><body><script type="application/ld+json">${JSON.stringify(ld)}</script></body></html>`;

describe('AlcampoAdapter (Puppeteer S128)', () => {
  let adapter: AlcampoAdapter;

  beforeEach(() => {
    adapter = new AlcampoAdapter();
    mockedPoliteFetchRaw.mockReset();
    mockedPuppeteer.mockReset();
    mockedClose.mockReset().mockResolvedValue(undefined);
  });

  it('extrai produtos via sitemap + Puppeteer JSON-LD', async () => {
    mockedPoliteFetchRaw.mockImplementation((url: string) => {
      if (url.endsWith('sitemap_index.xml'))
        return Promise.resolve({ body: SITEMAP_INDEX_XML, status: 200, setCookie: [] }) as any;
      if (url.endsWith('sitemap-products-part1.xml'))
        return Promise.resolve({ body: SITEMAP_PRODUCTS_XML, status: 200, setCookie: [] }) as any;
      return Promise.resolve({ body: '', status: 404, setCookie: [] }) as any;
    });
    mockedPuppeteer.mockImplementation((url: string) => {
      if (url.includes('54178')) {
        return Promise.resolve({
          html: htmlWithLd(productLd({})),
          finalUrl: url,
          status: 200,
        });
      }
      if (url.includes('50733')) {
        return Promise.resolve({
          html: htmlWithLd(
            productLd({
              name: 'Leche pack 6 x 1 L',
              sku: 'SKU-50733',
              offers: {
                '@type': 'Offer',
                price: '5.49',
                availability: 'https://schema.org/InStock',
              },
            }),
          ),
          finalUrl: url,
          status: 200,
        });
      }
      return Promise.resolve({ html: '', finalUrl: url, status: 200 });
    });

    const products = await adapter.fetchProducts();
    expect(products.length).toBe(2);

    const byId = new Map(products.map((p) => [p.externalId, p]));
    expect(byId.get('SKU-54178')).toMatchObject({
      name: 'Leche entera 1 L',
      brand: 'Auchan',
      ean: '8410000000013',
      price: 0.99,
      packageUnit: 'LITER',
      packageSize: 1,
      imageUrl: 'https://img.alcampo.es/54178.jpg',
      categoryHint: 'Lácteos',
    });
    expect(byId.get('SKU-50733')).toMatchObject({
      name: 'Leche pack 6 x 1 L',
      price: 5.49,
      packageUnit: 'LITER',
      packageSize: 6,
    });
  });

  it('retorna [] quando sitemap_index falha', async () => {
    mockedPoliteFetchRaw.mockResolvedValue({
      body: '',
      status: 503,
      setCookie: [],
    } as any);
    const products = await adapter.fetchProducts();
    expect(products).toEqual([]);
    // Não deve nem tentar Puppeteer se sitemap falha
    expect(mockedPuppeteer).not.toHaveBeenCalled();
  });

  it('sempre chama closePuppeteerBrowser (liberar memória Render)', async () => {
    mockedPoliteFetchRaw.mockImplementation((url: string) => {
      if (url.endsWith('sitemap_index.xml'))
        return Promise.resolve({ body: SITEMAP_INDEX_XML, status: 200, setCookie: [] }) as any;
      if (url.endsWith('sitemap-products-part1.xml'))
        return Promise.resolve({ body: SITEMAP_PRODUCTS_XML, status: 200, setCookie: [] }) as any;
      return Promise.resolve({ body: '', status: 404, setCookie: [] }) as any;
    });
    mockedPuppeteer.mockRejectedValue(new Error('chromium OOM'));

    await adapter.fetchProducts();
    expect(mockedClose).toHaveBeenCalledTimes(1);
  });

  it('pula produto sem Product schema JSON-LD', async () => {
    mockedPoliteFetchRaw.mockImplementation((url: string) => {
      if (url.endsWith('sitemap_index.xml'))
        return Promise.resolve({ body: SITEMAP_INDEX_XML, status: 200, setCookie: [] }) as any;
      if (url.endsWith('sitemap-products-part1.xml'))
        return Promise.resolve({ body: SITEMAP_PRODUCTS_XML, status: 200, setCookie: [] }) as any;
      return Promise.resolve({ body: '', status: 404, setCookie: [] }) as any;
    });
    mockedPuppeteer.mockResolvedValue({
      html: htmlWithLd({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [],
      }),
      finalUrl: '',
      status: 200,
    });

    const products = await adapter.fetchProducts();
    expect(products).toEqual([]);
  });
});
