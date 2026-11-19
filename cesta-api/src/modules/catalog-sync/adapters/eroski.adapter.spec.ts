import { EroskiAdapter } from './eroski.adapter';
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

// Fixture reduzido mimetizando HTML real Eroski — <a class="product-title-link"
// data-metrics="...ecommerce JSON..."> capturado em S124.
const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
<url><loc>https://supermercado.eroski.es/es/login/</loc></url>
<url><loc>https://supermercado.eroski.es/es/supermercado/2059698-frescos/2059699-frutas/2059700-naranjas-y-otros-citricos/</loc></url>
<url><loc>https://supermercado.eroski.es/es/supermercado/2059698-frescos/2059799-lacteos/2059800-leches/</loc></url>
<url><loc>https://supermercado.eroski.es/es/supermercado/2059698-frescos/</loc></url>
</urlset>`;

// HTML fragment with 2 product tiles (minimum viable for parser)
const metricsEncode = (obj: unknown) =>
  JSON.stringify(obj).replace(/"/g, '&quot;');

const NARANJAS_HTML = `<html><body>
<h2 class="product-title"><a class="product-title-link" data-metrics="${metricsEncode(
  {
    event: 'select_item',
    ecommerce: {
      currency: 'EUR',
      items: [
        {
          price: 4.65,
          index: 1,
          quantity: 1,
          item_name: 'Naranja EROSKI, malla 3 kg',
          item_id: '23760622',
          item_brand: 'EROSKI.',
          item_category: '2059698',
          item_category2: '2059699',
          item_category3: '2059700',
          item_variant: '',
        },
      ],
    },
  },
)}" href="/es/productdetail/23760622-naranja-eroski-malla-3-kg/">Naranja EROSKI, malla 3 kg</a></h2>

<h2 class="product-title"><a class="product-title-link" data-metrics="${metricsEncode(
  {
    event: 'select_item',
    ecommerce: {
      currency: 'EUR',
      items: [
        {
          price: 2.15,
          item_name: 'Mandarina 1 kg',
          item_id: '98765',
          item_brand: '',
          item_category: '2059698',
          item_category3: '2059700',
        },
      ],
    },
  },
)}" href="/es/productdetail/98765-mandarina/">Mandarina 1 kg</a></h2>
</body></html>`;

const LACTEOS_HTML = `<html><body>
<a class="product-title-link" data-metrics="${metricsEncode(
  {
    ecommerce: {
      items: [
        {
          price: 5.49,
          item_name: 'Leche entera CENTRAL LECHERA ASTURIANA pack 6 x 1 L',
          item_id: '11111',
          item_brand: 'Central Lechera Asturiana',
        },
      ],
    },
  },
)}" href="/es/productdetail/11111/">Leche</a>
<a class="product-title-link" data-metrics="${metricsEncode(
  {
    ecommerce: {
      items: [
        {
          price: 'not-a-number',
          item_name: 'Preço inválido',
          item_id: '22222',
        },
      ],
    },
  },
)}" href="/#">Inválido</a>
<a class="product-title-link" data-metrics="malformed{json">Malformed</a>
</body></html>`;

describe('EroskiAdapter', () => {
  let adapter: EroskiAdapter;

  beforeEach(() => {
    adapter = new EroskiAdapter();
    mockedPoliteFetchRaw.mockReset();
  });

  it('expõe definition com slug/name/color para auto-register', () => {
    expect(adapter.definition).toEqual({
      slug: 'eroski',
      name: 'Eroski',
      color: '#E30613',
    });
  });

  it('carrega sitemap + categoria HTML + extrai ecommerce JSON do data-metrics', async () => {
    mockedPoliteFetchRaw.mockImplementation((url: string) => {
      if (url.endsWith('/sitemap.xml'))
        return Promise.resolve({ body: SITEMAP_XML, status: 200, setCookie: [] }) as any;
      if (url.includes('naranjas'))
        return Promise.resolve({ body: NARANJAS_HTML, status: 200, setCookie: [] }) as any;
      if (url.includes('leches'))
        return Promise.resolve({ body: LACTEOS_HTML, status: 200, setCookie: [] }) as any;
      return Promise.resolve({ body: '', status: 404, setCookie: [] }) as any;
    });

    const products = await adapter.fetchProducts();
    const byId = new Map(products.map((p) => [p.externalId, p]));

    expect(products.length).toBe(3); // 2 naranjas + 1 lacteos válido

    expect(byId.get('23760622')).toMatchObject({
      externalId: '23760622',
      name: 'Naranja EROSKI, malla 3 kg',
      brand: 'EROSKI', // trailing dot stripped
      ean: null,
      price: 4.65,
      onPromotion: false,
      packageUnit: 'KILOGRAM',
      comparisonUnit: 'KILOGRAM',
      packageSize: 3,
      imageUrl: 'https://supermercado.eroski.es/images/23760622.jpg',
      isAvailable: true,
    });

    expect(byId.get('98765')).toMatchObject({
      externalId: '98765',
      brand: null, // item_brand '' → null
      price: 2.15,
      packageSize: 1,
      packageUnit: 'KILOGRAM',
    });

    expect(byId.get('11111')).toMatchObject({
      externalId: '11111',
      name: 'Leche entera CENTRAL LECHERA ASTURIANA pack 6 x 1 L',
      brand: 'Central Lechera Asturiana',
      price: 5.49,
      packageUnit: 'LITER',
      comparisonUnit: 'LITER',
      packageSize: 6, // pack 6 x 1 L = 6L
    });

    // Produtos inválidos (preço NaN + JSON malformed) são pulados
    expect(byId.has('22222')).toBe(false);
  });

  it('retorna [] quando sitemap vazio', async () => {
    mockedPoliteFetchRaw.mockResolvedValue({
      body: '<?xml version="1.0"?><urlset></urlset>',
      status: 200,
      setCookie: [],
    });
    const products = await adapter.fetchProducts();
    expect(products).toEqual([]);
  });

  it('filtra URLs não-categorias do sitemap', async () => {
    mockedPoliteFetchRaw.mockImplementation((url: string) => {
      if (url.endsWith('/sitemap.xml'))
        return Promise.resolve({
          body: `<?xml version="1.0"?><urlset>
            <url><loc>https://supermercado.eroski.es/es/login/</loc></url>
            <url><loc>https://supermercado.eroski.es/es/supermercado/2059698-frescos/</loc></url>
            <url><loc>https://supermercado.eroski.es/es/supermercado/2059698-frescos/2059700-naranjas/</loc></url>
          </urlset>`,
          status: 200,
          setCookie: [],
        }) as any;
      if (url.includes('naranjas'))
        return Promise.resolve({ body: NARANJAS_HTML, status: 200, setCookie: [] }) as any;
      return Promise.resolve({ body: '', status: 404, setCookie: [] }) as any;
    });

    await adapter.fetchProducts();

    const calls = mockedPoliteFetchRaw.mock.calls.map((c) => c[0]);
    // URLs chamadas: sitemap + apenas /supermercado/ com >= 2 segmentos após prefix
    expect(calls).toContain('https://supermercado.eroski.es/sitemap.xml');
    expect(calls.some((u) => u.includes('/login/'))).toBe(false);
    // Nota: /supermercado/<x>/ tem 1 segmento → filtrada; /supermercado/<x>/<y>/ tem 2 → incluída
    expect(calls.some((u) => u.includes('2059700-naranjas'))).toBe(true);
  });

  it('não aborta quando categoria HTML retorna 404', async () => {
    mockedPoliteFetchRaw.mockImplementation((url: string) => {
      if (url.endsWith('/sitemap.xml'))
        return Promise.resolve({ body: SITEMAP_XML, status: 200, setCookie: [] }) as any;
      if (url.includes('naranjas'))
        return Promise.resolve({ body: '', status: 404, setCookie: [] }) as any;
      if (url.includes('leches'))
        return Promise.resolve({ body: LACTEOS_HTML, status: 200, setCookie: [] }) as any;
      return Promise.resolve({ body: '', status: 404, setCookie: [] }) as any;
    });

    const products = await adapter.fetchProducts();
    expect(products.find((p) => p.externalId === '11111')).toBeDefined();
  });
});
