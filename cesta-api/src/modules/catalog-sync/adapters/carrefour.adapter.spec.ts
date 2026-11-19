import { CarrefourAdapter } from './carrefour.adapter';
import {
  politeFetch,
  politeFetchRaw,
  serializeCookieJar,
} from '../utils/polite-fetch';

jest.mock('../utils/polite-fetch', () => {
  const actual = jest.requireActual('../utils/polite-fetch');
  return {
    ...actual,
    politeFetch: jest.fn(),
    politeFetchRaw: jest.fn().mockResolvedValue({ body: '', status: 200, setCookie: [] }),
  };
});
jest.mock('../utils/user-agents', () => ({
  pickUserAgent: () => 'test-ua',
}));

const mockedPoliteFetch = politeFetch as jest.MockedFunction<typeof politeFetch>;
const mockedPoliteFetchRaw = politeFetchRaw as jest.MockedFunction<typeof politeFetchRaw>;

const LECHE_FIXTURE = {
  results: [
    {
      id: 'C-001',
      display_name: 'Leche entera Carrefour brick 1L',
      brand: 'Carrefour',
      ean: '8410128000013',
      image_path: 'https://static.carrefour.es/img/C-001.jpg',
      price_info: {
        current_price: 0.95,
        previous_price: null,
        on_promotion: false,
      },
      availability: { is_available: true },
      package_info: { quantity: 1, unit_of_measure: 'L' },
      category_names: ['Lácteos', 'Leche'],
    },
    {
      id: 'C-002',
      display_name: 'Leche entera Hacendado pack 6',
      brand: 'Hacendado',
      ean: '8480000181749',
      image_path: null,
      price_info: {
        current_price: '5.10',
        previous_price: '5.70',
        on_promotion: true,
      },
      availability: { is_available: true },
      package_info: { quantity: 6, unit_of_measure: 'L' },
      category_names: ['Leche'],
    },
  ],
};

const YOGUR_FIXTURE = {
  results: [
    {
      id: 'C-010',
      display_name: 'Yogur natural pack 4x125g',
      brand: 'Danone',
      ean: null,
      images: [{ url: 'https://static.carrefour.es/img/C-010.jpg' }],
      price_info: {
        current_price: 1.85,
        on_promotion: false,
      },
      availability: { is_available: true },
      package_info: { quantity: 500, unit_of_measure: 'g' },
      category_names: ['Yogures'],
    },
  ],
};

describe('CarrefourAdapter', () => {
  let adapter: CarrefourAdapter;

  beforeEach(() => {
    adapter = new CarrefourAdapter();
    mockedPoliteFetch.mockReset();
    mockedPoliteFetchRaw.mockReset();
    mockedPoliteFetchRaw.mockResolvedValue({
      body: '',
      status: 200,
      setCookie: [],
    });
  });

  it('normaliza produtos oficiais em RawProduct[]', async () => {
    mockedPoliteFetch.mockImplementation((url: string) => {
      if (url.includes('query=leche')) {
        return Promise.resolve(LECHE_FIXTURE) as any;
      }
      if (url.includes('query=yogur')) {
        return Promise.resolve(YOGUR_FIXTURE) as any;
      }
      return Promise.resolve({ results: [] }) as any;
    });

    const products = await adapter.fetchProducts();

    const byId = new Map(products.map((p) => [p.externalId, p]));
    expect(byId.size).toBeGreaterThanOrEqual(3);

    const leche1 = byId.get('C-001');
    expect(leche1).toMatchObject({
      externalId: 'C-001',
      name: 'Leche entera Carrefour brick 1L',
      brand: 'Carrefour',
      ean: '8410128000013',
      price: 0.95,
      onPromotion: false,
      previousPrice: null,
      packageUnit: 'LITER',
      comparisonUnit: 'LITER',
      packageSize: 1,
      isAvailable: true,
    });

    const leche6 = byId.get('C-002');
    expect(leche6).toMatchObject({
      externalId: 'C-002',
      price: 5.1,
      onPromotion: true,
      previousPrice: 5.7,
      packageUnit: 'LITER',
      packageSize: 6,
    });

    const yogur = byId.get('C-010');
    expect(yogur).toMatchObject({
      externalId: 'C-010',
      brand: 'Danone',
      ean: null,
      price: 1.85,
      packageUnit: 'GRAM',
      comparisonUnit: 'KILOGRAM',
      packageSize: 500,
      imageUrl: 'https://static.carrefour.es/img/C-010.jpg',
    });
  });

  it('dedupa produtos repetidos entre queries', async () => {
    mockedPoliteFetch.mockResolvedValue(LECHE_FIXTURE as any);

    const products = await adapter.fetchProducts();

    const ids = products.map((p) => p.externalId);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
    expect(unique.has('C-001')).toBe(true);
    expect(unique.has('C-002')).toBe(true);
  });

  it('pula produtos sem preço válido', async () => {
    mockedPoliteFetch.mockResolvedValue({
      results: [
        { id: 'X-1', display_name: 'sem preço', price_info: null },
        {
          id: 'X-2',
          display_name: 'preço zero',
          price_info: { current_price: 0 },
          availability: { is_available: true },
          package_info: { quantity: 1, unit_of_measure: 'ud' },
        },
        {
          id: 'X-3',
          display_name: 'ok',
          price_info: { current_price: '2.50' },
          availability: { is_available: true },
          package_info: { quantity: 1, unit_of_measure: 'ud' },
        },
      ],
    } as any);

    const products = await adapter.fetchProducts();

    expect(products.map((p) => p.externalId)).toContain('X-3');
    expect(products.map((p) => p.externalId)).not.toContain('X-1');
    expect(products.map((p) => p.externalId)).not.toContain('X-2');
  });

  it('não aborta run se politeFetch rejeita uma query', async () => {
    let call = 0;
    mockedPoliteFetch.mockImplementation(() => {
      call += 1;
      if (call === 1) return Promise.reject(new Error('akamai 403'));
      return Promise.resolve(YOGUR_FIXTURE) as any;
    });

    const products = await adapter.fetchProducts();

    expect(products.find((p) => p.externalId === 'C-010')).toBeDefined();
  });

  it('retorna [] quando todas as queries retornam null', async () => {
    mockedPoliteFetch.mockResolvedValue(null as any);

    const products = await adapter.fetchProducts();

    expect(products).toEqual([]);
  });

  // Sprint 120 — warmup + cookie session
  it('warmup extrai Set-Cookie e passa Cookie header nas queries', async () => {
    const setCookie = [
      'ak_bmsc=abc123; Path=/; Max-Age=3600',
      'bm_sv=xyz456; Path=/; Max-Age=1800',
    ];
    mockedPoliteFetchRaw.mockResolvedValueOnce({
      body: '<html></html>',
      status: 200,
      setCookie,
    });
    mockedPoliteFetch.mockResolvedValue({ results: [] } as any);

    await adapter.fetchProducts();

    const expectedCookie = serializeCookieJar(setCookie);
    expect(expectedCookie).toBe('ak_bmsc=abc123; bm_sv=xyz456');

    // Primeira chamada de search (query=leche) deve conter cookie.
    const firstSearchCall = mockedPoliteFetch.mock.calls[0];
    expect(firstSearchCall[1]).toMatchObject({
      cookie: expectedCookie,
      referer: 'https://www.carrefour.es/',
      maxRetries: 5,
      minWaitOnBlockMs: 30_000,
    });
  });

  it('warmup sem cookies ainda roda queries (fallback graceful)', async () => {
    mockedPoliteFetchRaw.mockResolvedValueOnce({
      body: '<html></html>',
      status: 200,
      setCookie: [],
    });
    mockedPoliteFetch.mockResolvedValue(YOGUR_FIXTURE as any);

    const products = await adapter.fetchProducts();

    const firstSearchCall = mockedPoliteFetch.mock.calls[0];
    expect(firstSearchCall[1]).not.toHaveProperty('cookie', expect.any(String));
    expect(products.find((p) => p.externalId === 'C-010')).toBeDefined();
  });

  it('search eventualmente resolve após 403 inicial (politeFetch handles retry)', async () => {
    // politeFetch é mockado; teste valida que adapter.search não trata 403
    // como fatal — passa thru pra politeFetch que internamente retry (coberto
    // em polite-fetch.spec). Aqui simulamos retry bem-sucedido retornando
    // produto válido em uma query e null em outras (403 swallowed internamente).
    let call = 0;
    mockedPoliteFetch.mockImplementation(() => {
      call += 1;
      // Primeira query retorna null (403 after retry exhausted by politeFetch),
      // segunda retorna YOGUR_FIXTURE (politeFetch internamente recuperou).
      if (call === 1) return Promise.resolve(null) as any;
      return Promise.resolve(YOGUR_FIXTURE) as any;
    });

    const products = await adapter.fetchProducts();

    expect(products.find((p) => p.externalId === 'C-010')).toBeDefined();
  });
});
