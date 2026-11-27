import { FroizAdapter } from './froiz.adapter';
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

function mockBareResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => body,
  } as unknown as Response;
}

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?><urlset>
  <url><loc>https://supermercado.froiz.com/alimentacion</loc></url>
  <url><loc>https://supermercado.froiz.com/alimentacion/galletas</loc></url>
  <url><loc>https://supermercado.froiz.com/alimentacion/galletas/galletas-especialidades/sin-azucar</loc></url>
  <url><loc>https://supermercado.froiz.com/alimentacion/galletas/galletas-especialidades</loc></url>
  <url><loc>https://supermercado.froiz.com/product/7054-bombilla-cegasa-led-standard-14w-e27-calida</loc></url>
</urlset>`;

const CATEGORY_HTML = `<html><body>
<div class="product-grid">
  <div class="product">
    <div class="offer">Oferta</div>
    <img src="https://froiz.com/cdn-cgi/img/aaa/desktop" />
    <div class="name">Leche entera Froiz brick 1 L</div>
    <div class="price">
      <span>1,49 €</span>
      <span class="text-primary">1,29 €</span>
    </div>
    <div class="price-by-meas">1,29 € /L</div>
  </div>
  <div class="product">
    <img src="https://froiz.com/cdn-cgi/img/bbb/desktop" />
    <div class="name">Galletas Froiz pack 3x100 g</div>
    <div class="price">
      <span>2,50 €</span>
    </div>
  </div>
  <div class="product">
    <div class="name">Produto sem preço</div>
  </div>
</div>
</body></html>`;

const SECOND_CATEGORY_HTML = `<html><body>
<div class="product-grid">
  <div class="product">
    <img src="https://froiz.com/cdn-cgi/img/ccc/desktop" />
    <div class="name">Leche entera Froiz brick 1 L</div>
    <div class="price"><span>1,29 €</span></div>
  </div>
  <div class="product">
    <img src="https://froiz.com/cdn-cgi/img/ddd/desktop" />
    <div class="name">Pan integral Froiz 500 g</div>
    <div class="price"><span>1,80 €</span></div>
  </div>
</div>
</body></html>`;

describe('FroizAdapter', () => {
  let adapter: FroizAdapter;
  const originalFetch = global.fetch;

  beforeEach(() => {
    adapter = new FroizAdapter();
    mockedPoliteFetchRaw.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('expõe definition com slug/name/color pra auto-register', () => {
    expect(adapter.definition).toEqual({
      slug: 'froiz',
      name: 'Froiz',
      color: '#4BA82E',
    });
  });

  it('extrai produtos de categoria filtrando depth 3+4 + parseia preço/promo/pack', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(mockBareResponse(SITEMAP_XML));
    global.fetch = fetchMock as unknown as typeof fetch;
    mockedPoliteFetchRaw.mockImplementation((url: string) => {
      if (url.includes('sin-azucar')) {
        return Promise.resolve({
          body: CATEGORY_HTML,
          status: 200,
          setCookie: [],
        }) as any;
      }
      return Promise.resolve({
        body: SECOND_CATEGORY_HTML,
        status: 200,
        setCookie: [],
      }) as any;
    });

    const products = await adapter.fetchProducts();
    const byId = new Map(products.map((p) => [p.externalId, p]));

    // Ao menos 3 produtos únicos (dedup pela normalizedId=name slug)
    expect(products.length).toBeGreaterThanOrEqual(3);

    // Leche em promo — previousPrice e price captados
    const leche = byId.get('leche-entera-froiz-brick-1-l');
    expect(leche).toMatchObject({
      name: 'Leche entera Froiz brick 1 L',
      price: 1.29,
      previousPrice: 1.49,
      onPromotion: true,
      packageUnit: 'LITER',
      packageSize: 1,
      imageUrl: expect.stringContaining('cdn-cgi/img'),
    });

    // Galletas pack
    const galletas = byId.get('galletas-froiz-pack-3x100-g');
    expect(galletas).toMatchObject({
      price: 2.5,
      onPromotion: false,
      previousPrice: null,
      packageUnit: 'GRAM',
      packageSize: 300,
    });

    // Pan integral (categoria 2)
    const pan = byId.get('pan-integral-froiz-500-g');
    expect(pan?.price).toBe(1.8);

    // Produto sem preço filtrado
    expect(products.some((p) => p.name.includes('sem preço'))).toBe(false);
  });

  it('bubble up error quando sitemap vazio (anti silent-failure)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      mockBareResponse('<?xml version="1.0"?><urlset></urlset>'),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(adapter.fetchProducts()).rejects.toThrow(
      /0 categorias no sitemap/,
    );
  });

  it('bubble up quando todas categorias falham fetchHtml (anti silent-failure)', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(mockBareResponse(SITEMAP_XML));
    global.fetch = fetchMock as unknown as typeof fetch;
    mockedPoliteFetchRaw.mockResolvedValue({
      body: '',
      status: 503,
      setCookie: [],
    } as any);
    await expect(adapter.fetchProducts()).rejects.toThrow(
      /0 produtos em .* categorias/,
    );
  });

  it('respeita FROIZ_MAX_CATEGORIES env pra limitar fatia', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(mockBareResponse(SITEMAP_XML));
    global.fetch = fetchMock as unknown as typeof fetch;
    mockedPoliteFetchRaw.mockResolvedValue({
      body: CATEGORY_HTML,
      status: 200,
      setCookie: [],
    } as any);
    const prev = process.env.FROIZ_MAX_CATEGORIES;
    process.env.FROIZ_MAX_CATEGORIES = '1';
    try {
      await adapter.fetchProducts();
      // Com max=1, só 1 categoria fetchada
      expect(mockedPoliteFetchRaw).toHaveBeenCalledTimes(1);
    } finally {
      if (prev === undefined) delete process.env.FROIZ_MAX_CATEGORIES;
      else process.env.FROIZ_MAX_CATEGORIES = prev;
    }
  });

  it('não aborta quando 1 categoria falha mas outras vêm OK', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(mockBareResponse(SITEMAP_XML));
    global.fetch = fetchMock as unknown as typeof fetch;
    mockedPoliteFetchRaw.mockImplementation((url: string) => {
      if (url.includes('sin-azucar')) {
        return Promise.resolve({ body: '', status: 503, setCookie: [] }) as any;
      }
      return Promise.resolve({
        body: SECOND_CATEGORY_HTML,
        status: 200,
        setCookie: [],
      }) as any;
    });
    const products = await adapter.fetchProducts();
    expect(products.find((p) => p.name.includes('Pan integral'))).toBeDefined();
  });

  it('S221: logga dropouts por categoria/tile pra observabilidade', async () => {
    // Sitemap: 2 leaves. Primeira falha fetch (503), segunda retorna HTML
    // com 2 tiles — 1 ok + 1 sem preço (dropout tileNoPrice).
    const fetchMock = jest
      .fn()
      .mockResolvedValue(mockBareResponse(SITEMAP_XML));
    global.fetch = fetchMock as unknown as typeof fetch;
    const htmlWithDrops = `<html><body>
      <div class="product-grid">
        <div class="product">
          <div class="name">Pan integral Froiz 500 g</div>
          <div class="price"><span>1,80 €</span></div>
        </div>
        <div class="product">
          <div class="name">Produto sem preço</div>
        </div>
      </div>
    </body></html>`;
    mockedPoliteFetchRaw.mockImplementation((url: string) => {
      if (url.includes('sin-azucar')) {
        return Promise.resolve({ body: '', status: 503, setCookie: [] }) as any;
      }
      return Promise.resolve({
        body: htmlWithDrops,
        status: 200,
        setCookie: [],
      }) as any;
    });
    const logSpy = jest.spyOn((adapter as any).logger, 'log');
    await adapter.fetchProducts();
    const finalLog = logSpy.mock.calls
      .map((c) => c[0] as string)
      .find((m) => m.startsWith('Froiz:'));
    expect(finalLog).toBeDefined();
    expect(finalLog).toContain('fetch=1');
    expect(finalLog).toContain('noprice=1');
    expect(finalLog).toContain('dup=0');
  });
});
