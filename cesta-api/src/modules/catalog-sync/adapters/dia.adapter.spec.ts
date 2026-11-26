import { DiaAdapter } from './dia.adapter';
import { politeFetch } from '../utils/polite-fetch';

jest.mock('../utils/polite-fetch');
jest.mock('../utils/user-agents', () => ({
  pickUserAgent: () => 'test-ua',
}));

const mockedPoliteFetch = politeFetch as jest.MockedFunction<typeof politeFetch>;

// Fixtures observacionais capturadas de https://www.dia.es/api/v1/search-back/search
// em S122 (shape real).
const LECHE_P1 = {
  pagination: { page_number: 1, page_size: 30, total_pages: 2 },
  search_items: [
    {
      object_id: '504P6',
      sku_id: '504P6',
      display_name: 'Leche semidesnatada Dia Láctea pack 6 x 1 L',
      brand: 'Dia Láctea',
      dia_brand: true,
      image: '/product_images/504P6/504P6_ISO_0_ES.jpg',
      l1_category_description: 'Huevos, leche y mantequilla',
      l2_category_description: 'Leche',
      prices: {
        currency: 'EUR',
        discount_percentage: 0,
        is_promo_price: false,
        measure_unit: 'LITRO',
        price: 4.98,
        price_per_unit: 0.83,
        strikethrough_price: 4.98,
      },
      units_in_stock: 671,
      url: '/huevos-leche-y-mantequilla/leche/p/504P6',
    },
    {
      object_id: '601234',
      sku_id: '601234',
      display_name: 'Leche entera Hacendado brick 1 L',
      brand: 'Hacendado',
      image: 'https://static.example/absolute.jpg',
      l2_category_description: 'Leche',
      prices: {
        is_promo_price: true,
        discount_percentage: 15,
        measure_unit: 'LITRO',
        price: 0.85,
        price_per_unit: 0.85,
        strikethrough_price: 1.0,
      },
      units_in_stock: 50,
    },
  ],
};

const LECHE_P2 = {
  pagination: { page_number: 2, page_size: 30, total_pages: 2 },
  search_items: [
    {
      object_id: '777888',
      sku_id: '777888',
      display_name: 'Leche sin lactosa 1 L',
      brand: null,
      image: '/product_images/777888/img.jpg',
      prices: {
        is_promo_price: false,
        discount_percentage: 0,
        measure_unit: 'LITRO',
        price: 1.25,
        strikethrough_price: 1.25,
      },
      units_in_stock: 10,
    },
  ],
};

const QUESO = {
  pagination: { page_number: 1, page_size: 30, total_pages: 1 },
  search_items: [
    {
      object_id: '263518',
      display_name: 'Queso de untar natural Dia Láctea 250 g',
      brand: 'Dia Láctea',
      image: '/product_images/263518/img.jpg',
      l2_category_description: 'Untable y en porciones',
      prices: {
        measure_unit: 'KILO',
        price: 1.17,
        price_per_unit: 4.68,
        strikethrough_price: 1.17,
        is_promo_price: false,
        discount_percentage: 0,
      },
      units_in_stock: 255,
    },
  ],
};

describe('DiaAdapter', () => {
  let adapter: DiaAdapter;

  beforeEach(() => {
    adapter = new DiaAdapter();
    mockedPoliteFetch.mockReset();
  });

  it('normaliza produtos reais DIA (shape search-back)', async () => {
    mockedPoliteFetch.mockImplementation((url: string) => {
      if (url.includes('q=leche&page=1')) return Promise.resolve(LECHE_P1) as any;
      if (url.includes('q=leche&page=2')) return Promise.resolve(LECHE_P2) as any;
      if (url.includes('q=queso')) return Promise.resolve(QUESO) as any;
      return Promise.resolve({ search_items: [], pagination: { total_pages: 1 } }) as any;
    });

    const products = await adapter.fetchProducts();
    const byId = new Map(products.map((p) => [p.externalId, p]));

    expect(products.length).toBeGreaterThanOrEqual(4);

    expect(byId.get('504P6')).toMatchObject({
      externalId: '504P6',
      name: 'Leche semidesnatada Dia Láctea pack 6 x 1 L',
      brand: 'Dia Láctea',
      ean: null,
      price: 4.98,
      previousPrice: null,
      onPromotion: false,
      packageUnit: 'LITER',
      comparisonUnit: 'LITER',
      packageSize: 6,
      imageUrl: 'https://www.dia.es/product_images/504P6/504P6_ISO_0_ES.jpg',
      categoryHint: 'Leche',
      isAvailable: true,
    });

    expect(byId.get('601234')).toMatchObject({
      externalId: '601234',
      brand: 'Hacendado',
      price: 0.85,
      previousPrice: 1.0,
      onPromotion: true,
      imageUrl: 'https://static.example/absolute.jpg',
    });

    expect(byId.get('777888')).toMatchObject({
      externalId: '777888',
      brand: null,
      price: 1.25,
      previousPrice: null,
      onPromotion: false,
    });

    expect(byId.get('263518')).toMatchObject({
      externalId: '263518',
      name: 'Queso de untar natural Dia Láctea 250 g',
      price: 1.17,
      comparisonUnit: 'KILOGRAM',
      packageUnit: 'GRAM',
      packageSize: 250,
    });
  });

  it('pagina até total_pages (cap MAX_PAGES_PER_QUERY)', async () => {
    mockedPoliteFetch.mockImplementation((url: string) => {
      if (url.includes('q=leche&page=1')) return Promise.resolve(LECHE_P1) as any;
      if (url.includes('q=leche&page=2')) return Promise.resolve(LECHE_P2) as any;
      return Promise.resolve({ search_items: [], pagination: { total_pages: 1 } }) as any;
    });

    const products = await adapter.fetchProducts();
    const ids = products.map((p) => p.externalId);
    expect(ids).toContain('504P6');
    expect(ids).toContain('601234');
    expect(ids).toContain('777888');
  });

  it('pula produtos sem object_id/sku_id ou preço inválido', async () => {
    mockedPoliteFetch.mockResolvedValue({
      pagination: { page_number: 1, page_size: 30, total_pages: 1 },
      search_items: [
        { display_name: 'sem id', prices: { price: 1.0 } },
        {
          object_id: 'Z-2',
          display_name: 'preço zero',
          prices: { price: 0, measure_unit: 'UNIDAD' },
          units_in_stock: 10,
        },
        {
          object_id: 'Z-3',
          display_name: 'preço null',
          prices: { price: null, measure_unit: 'UNIDAD' },
        },
        {
          object_id: 'Z-4',
          display_name: 'ok 1 L',
          prices: {
            price: '2.50',
            measure_unit: 'LITRO',
            is_promo_price: false,
            discount_percentage: 0,
          },
          units_in_stock: 5,
        },
      ],
    } as any);

    const products = await adapter.fetchProducts();
    const ids = products.map((p) => p.externalId);
    expect(ids).toContain('Z-4');
    expect(ids).not.toContain('Z-2');
    expect(ids).not.toContain('Z-3');
  });

  it('dedupa entre queries + marca unavailable quando units_in_stock=0', async () => {
    mockedPoliteFetch.mockResolvedValue({
      pagination: { page_number: 1, page_size: 30, total_pages: 1 },
      search_items: [
        {
          object_id: 'DUP-1',
          display_name: 'Producto duplicado 1 L',
          brand: 'X',
          prices: { price: 1.5, measure_unit: 'LITRO' },
          units_in_stock: 0,
        },
      ],
    } as any);

    const products = await adapter.fetchProducts();
    const ids = products.map((p) => p.externalId);
    expect(ids.filter((i) => i === 'DUP-1').length).toBe(1);
    expect(products[0]).toMatchObject({ isAvailable: false });
  });

  it('não aborta quando query lança', async () => {
    let call = 0;
    mockedPoliteFetch.mockImplementation(() => {
      call += 1;
      if (call === 1) return Promise.reject(new Error('timeout'));
      return Promise.resolve(QUESO) as any;
    });

    const products = await adapter.fetchProducts();
    expect(products.find((p) => p.externalId === '263518')).toBeDefined();
  });

  it('retorna [] quando todas queries retornam null', async () => {
    mockedPoliteFetch.mockResolvedValue(null as any);
    const products = await adapter.fetchProducts();
    expect(products).toEqual([]);
  });

  // S218 — regression guard for query-expansion coverage. Cosmetic drops of
  // seeds would silently shrink catalog growth; lock a minimum here.
  it('dispara pelo menos 70 queries distintas', async () => {
    const seen = new Set<string>();
    mockedPoliteFetch.mockImplementation((url: string) => {
      const q = url.match(/[?&]q=([^&]+)/)?.[1] ?? '';
      seen.add(decodeURIComponent(q));
      return Promise.resolve({
        pagination: { page_number: 1, page_size: 30, total_pages: 1 },
        search_items: [],
      }) as any;
    });

    await adapter.fetchProducts();
    expect(seen.size).toBeGreaterThanOrEqual(70);
  });
});
