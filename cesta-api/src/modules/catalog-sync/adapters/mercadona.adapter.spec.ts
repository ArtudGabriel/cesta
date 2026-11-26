import { MercadonaAdapter } from './mercadona.adapter';
import { politeFetch } from '../utils/polite-fetch';

jest.mock('../utils/polite-fetch');

const mockedPoliteFetch = politeFetch as jest.MockedFunction<typeof politeFetch>;

// Fixtures observacionais do endpoint real (resumidas). O shape bate com
// MercadonaProduct/MercadonaCategory em mercadona.adapter.ts.
const CATEGORIES_TREE_FIXTURE = {
  results: [
    {
      id: 112,
      name: 'Lácteos, huevos',
      categories: [
        { id: 113, name: 'Leche' },
        { id: 114, name: 'Yogures' },
      ],
    },
  ],
};

const LECHE_CATEGORY_FIXTURE = {
  id: 113,
  name: 'Leche',
  categories: [
    {
      id: 1130,
      name: 'Leche entera',
      products: [
        {
          id: '88451',
          display_name: 'Leche entera Hacendado brick',
          ean: '8480000181732',
          brand: 'Hacendado',
          thumbnail: 'https://prod-mercadona.imgix.net/images/88451.jpg',
          price_instructions: {
            unit_price: '0.85',
            price_decreased: false,
            previous_unit_price: null,
            size_format: '1 L',
            reference_format: 'por litro',
            unit_size: 1,
          },
          packaging: 'brick',
          active: true,
        },
        {
          id: '88452',
          display_name: 'Leche entera Hacendado pack 6',
          ean: '8480000181749',
          brand: 'Hacendado',
          thumbnail: 'https://prod-mercadona.imgix.net/images/88452.jpg',
          price_instructions: {
            unit_price: '5.10',
            price_decreased: true,
            previous_unit_price: '5.70',
            size_format: '6 L',
            reference_format: 'por litro',
            unit_size: 6,
          },
          packaging: 'brick',
          active: true,
        },
      ],
    },
  ],
};

const YOGURES_CATEGORY_FIXTURE = {
  id: 114,
  name: 'Yogures',
  products: [
    {
      id: '91001',
      display_name: 'Yogur natural Hacendado pack 4',
      ean: '8480000200011',
      brand: 'Hacendado',
      thumbnail: 'https://prod-mercadona.imgix.net/images/91001.jpg',
      price_instructions: {
        unit_price: '1.20',
        price_decreased: false,
        previous_unit_price: null,
        size_format: '500 g',
        reference_format: 'por kilo',
        unit_size: 500,
      },
      packaging: 'tarrina',
      active: true,
    },
  ],
};

describe('MercadonaAdapter', () => {
  let adapter: MercadonaAdapter;

  beforeEach(() => {
    adapter = new MercadonaAdapter();
    mockedPoliteFetch.mockReset();
  });

  it('fetches tree, walks sub-categories, and normalizes RawProduct[]', async () => {
    mockedPoliteFetch.mockImplementation((url: string) => {
      if (url.includes('/v1_1/categories/')) {
        return Promise.resolve(CATEGORIES_TREE_FIXTURE) as any;
      }
      if (url.includes('/categories/113/')) {
        return Promise.resolve(LECHE_CATEGORY_FIXTURE) as any;
      }
      if (url.includes('/categories/114/')) {
        return Promise.resolve(YOGURES_CATEGORY_FIXTURE) as any;
      }
      return Promise.resolve(null) as any;
    });

    const products = await adapter.fetchProducts();

    expect(products).toHaveLength(3);

    const [leche1, leche6, yogur] = products;

    expect(leche1).toMatchObject({
      externalId: '88451',
      name: 'Leche entera Hacendado brick',
      brand: 'Hacendado',
      ean: '8480000181732',
      categoryHint: 'Leche',
      price: 0.85,
      onPromotion: false,
      previousPrice: null,
      packageUnit: 'LITER',
      comparisonUnit: 'LITER',
      packageSize: 1,
      isAvailable: true,
    });

    expect(leche6).toMatchObject({
      externalId: '88452',
      price: 5.1,
      onPromotion: true,
      previousPrice: 5.7,
      packageUnit: 'LITER',
      packageSize: 6,
    });

    expect(yogur).toMatchObject({
      externalId: '91001',
      categoryHint: 'Yogures',
      price: 1.2,
      packageUnit: 'GRAM',
      comparisonUnit: 'KILOGRAM',
      packageSize: 500,
      isAvailable: true,
    });
  });

  it('uses bcn1 warehouse when postal code starts with 08', async () => {
    mockedPoliteFetch.mockResolvedValue({ results: [] } as any);

    await adapter.fetchProducts({ postalCode: '08001' });

    expect(mockedPoliteFetch).toHaveBeenCalledWith(
      expect.stringContaining('wh=bcn1'),
      expect.any(Object),
    );
  });

  // Sprint 187 (nit S108 P3): spec assimétrica — cobria só bcn1 (postal 08) mas
  // não default mad1 em outros códigos. Falha silenciosa se pivot mapping mudar.
  it('uses mad1 warehouse by default when postal code is omitted', async () => {
    mockedPoliteFetch.mockResolvedValue({ results: [] } as any);

    await adapter.fetchProducts();

    expect(mockedPoliteFetch).toHaveBeenCalledWith(
      expect.stringContaining('wh=mad1'),
      expect.any(Object),
    );
  });

  it('uses mad1 warehouse for madrid postal code 28xxx', async () => {
    mockedPoliteFetch.mockResolvedValue({ results: [] } as any);

    await adapter.fetchProducts({ postalCode: '28001' });

    expect(mockedPoliteFetch).toHaveBeenCalledWith(
      expect.stringContaining('wh=mad1'),
      expect.any(Object),
    );
  });

  it('returns empty array when tree fetch returns no categories', async () => {
    mockedPoliteFetch.mockResolvedValue({ results: [] } as any);

    const products = await adapter.fetchProducts();

    expect(products).toEqual([]);
  });

  it('skips products with missing or invalid prices', async () => {
    mockedPoliteFetch.mockImplementation((url: string) => {
      if (url.includes('/v1_1/categories/')) {
        return Promise.resolve({
          results: [{ id: 1, name: 'root', categories: [{ id: 2, name: 'sub' }] }],
        }) as any;
      }
      return Promise.resolve({
        id: 2,
        name: 'sub',
        products: [
          { id: 'a', display_name: 'no price', price_instructions: null },
          {
            id: 'b',
            display_name: 'zero price',
            price_instructions: { unit_price: '0' },
          },
          {
            id: 'c',
            display_name: 'valid',
            price_instructions: { unit_price: '1.00', size_format: '1 ud' },
            active: true,
          },
        ],
      }) as any;
    });

    const products = await adapter.fetchProducts();

    expect(products.map((p) => p.externalId)).toEqual(['c']);
  });
});
