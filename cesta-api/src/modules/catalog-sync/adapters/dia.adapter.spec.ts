import { DiaAdapter } from './dia.adapter';
import { politeFetch } from '../utils/polite-fetch';

jest.mock('../utils/polite-fetch');
jest.mock('../utils/user-agents', () => ({
  pickUserAgent: () => 'test-ua',
}));

const mockedPoliteFetch = politeFetch as jest.MockedFunction<typeof politeFetch>;

const LECHE_FIXTURE = {
  search_items: [
    {
      id: 'D-001',
      display_name: 'Leche entera DIA brick 1L',
      brand: 'DIA',
      ean: '8480017000013',
      images: [{ large_url: 'https://static.dia.es/img/D-001.jpg' }],
      prices: {
        price: '0.89',
        original_price: null,
      },
      has_offer: false,
      in_stock: true,
      weight: 1,
      measurement_unit: 'L',
      category_hierarchy: [{ name: 'Lácteos' }, { name: 'Leche' }],
    },
    {
      id: 'D-002',
      display_name: 'Leche semidesnatada DIA pack 6',
      brand: 'DIA',
      ean: '8480017000020',
      images: ['https://static.dia.es/img/D-002.jpg'],
      prices: {
        price: 4.75,
        original_price: '5.40',
      },
      has_offer: true,
      in_stock: true,
      weight: 6,
      measurement_unit: 'L',
      category_hierarchy: [{ name: 'Leche' }],
    },
  ],
};

const YOGUR_FIXTURE = {
  products: [
    {
      product_id: 'D-010',
      name: 'Yogur natural DIA pack 4x125g',
      brand: 'DIA',
      ean: null,
      images: [{ medium_url: 'https://static.dia.es/img/D-010.jpg' }],
      prices: { price: 1.49 },
      has_offer: false,
      in_stock: true,
      weight: 500,
      measurement_unit: 'g',
      category_hierarchy: [{ name: 'Yogures' }],
    },
  ],
};

describe('DiaAdapter', () => {
  let adapter: DiaAdapter;

  beforeEach(() => {
    adapter = new DiaAdapter();
    mockedPoliteFetch.mockReset();
  });

  it('normaliza produtos DIA em RawProduct[]', async () => {
    mockedPoliteFetch.mockImplementation((url: string) => {
      if (url.includes('q=leche')) return Promise.resolve(LECHE_FIXTURE) as any;
      if (url.includes('q=yogur')) return Promise.resolve(YOGUR_FIXTURE) as any;
      return Promise.resolve({ search_items: [] }) as any;
    });

    const products = await adapter.fetchProducts();
    const byId = new Map(products.map((p) => [p.externalId, p]));

    expect(byId.size).toBeGreaterThanOrEqual(3);

    expect(byId.get('D-001')).toMatchObject({
      externalId: 'D-001',
      name: 'Leche entera DIA brick 1L',
      brand: 'DIA',
      ean: '8480017000013',
      price: 0.89,
      onPromotion: false,
      previousPrice: null,
      packageUnit: 'LITER',
      comparisonUnit: 'LITER',
      packageSize: 1,
      isAvailable: true,
      imageUrl: 'https://static.dia.es/img/D-001.jpg',
    });

    expect(byId.get('D-002')).toMatchObject({
      externalId: 'D-002',
      price: 4.75,
      onPromotion: true,
      previousPrice: 5.4,
      packageUnit: 'LITER',
      packageSize: 6,
      imageUrl: 'https://static.dia.es/img/D-002.jpg',
    });

    expect(byId.get('D-010')).toMatchObject({
      externalId: 'D-010',
      name: 'Yogur natural DIA pack 4x125g',
      brand: 'DIA',
      ean: null,
      packageUnit: 'GRAM',
      comparisonUnit: 'KILOGRAM',
      packageSize: 500,
    });
  });

  it('pula produtos sem preço válido ou sem id', async () => {
    mockedPoliteFetch.mockResolvedValue({
      search_items: [
        { display_name: 'sem id', prices: { price: 1.0 } },
        {
          id: 'X-2',
          display_name: 'preço zero',
          prices: { price: 0 },
          in_stock: true,
          weight: 1,
          measurement_unit: 'ud',
        },
        {
          id: 'X-3',
          display_name: 'preço null',
          prices: { price: null },
        },
        {
          id: 'X-4',
          display_name: 'ok',
          prices: { price: '2.50' },
          in_stock: true,
          weight: 1,
          measurement_unit: 'ud',
        },
      ],
    } as any);

    const products = await adapter.fetchProducts();
    const ids = products.map((p) => p.externalId);

    expect(ids).toContain('X-4');
    expect(ids).not.toContain('X-2');
    expect(ids).not.toContain('X-3');
  });

  it('dedupa produtos repetidos entre queries', async () => {
    mockedPoliteFetch.mockResolvedValue(LECHE_FIXTURE as any);

    const products = await adapter.fetchProducts();
    const ids = products.map((p) => p.externalId);
    const unique = new Set(ids);

    expect(ids.length).toBe(unique.size);
    expect(unique.has('D-001')).toBe(true);
    expect(unique.has('D-002')).toBe(true);
  });

  it('aceita response com products/results fallback', async () => {
    mockedPoliteFetch.mockResolvedValue({
      results: [
        {
          id: 'D-100',
          display_name: 'Fallback results key',
          prices: { price: 1.25 },
          in_stock: true,
          weight: 1,
          measurement_unit: 'ud',
        },
      ],
    } as any);

    const products = await adapter.fetchProducts();
    expect(products.find((p) => p.externalId === 'D-100')).toBeDefined();
  });

  it('não aborta quando query lança', async () => {
    let call = 0;
    mockedPoliteFetch.mockImplementation(() => {
      call += 1;
      if (call === 1) return Promise.reject(new Error('timeout'));
      return Promise.resolve(YOGUR_FIXTURE) as any;
    });

    const products = await adapter.fetchProducts();
    expect(products.find((p) => p.externalId === 'D-010')).toBeDefined();
  });

  it('retorna [] quando todas queries retornam null', async () => {
    mockedPoliteFetch.mockResolvedValue(null as any);
    const products = await adapter.fetchProducts();
    expect(products).toEqual([]);
  });
});
