import { CarrefourAdapter } from './carrefour.adapter';
import { scrapingbeeFetch } from '../utils/scrapingbee-fetch';

jest.mock('../utils/scrapingbee-fetch', () => ({
  scrapingbeeFetch: jest.fn(),
}));

const mockedFetch = scrapingbeeFetch as jest.MockedFunction<typeof scrapingbeeFetch>;

const NEXT_DATA_LECHE = {
  props: {
    pageProps: {
      searchResults: {
        products: [
          {
            id: 'C-001',
            display_name: 'Leche entera Carrefour brick 1L',
            brand: 'Carrefour',
            ean: '8410128000013',
            image_path: 'https://static.carrefour.es/C-001.jpg',
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
            display_name: 'Leche pack 6 x 1 L',
            brand: 'Hacendado',
            image_path: null,
            price_info: {
              current_price: '5.10',
              previous_price: '5.70',
              on_promotion: true,
            },
            availability: { is_available: true },
            package_info: { quantity: 6, unit_of_measure: 'L' },
          },
        ],
      },
    },
  },
};

const htmlWithNextData = (payload: unknown) =>
  `<html><body>...<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script></body></html>`;

describe('CarrefourAdapter (ScrapingBee S134)', () => {
  let adapter: CarrefourAdapter;

  beforeEach(() => {
    adapter = new CarrefourAdapter();
    mockedFetch.mockReset();
  });

  it('extrai produtos de __NEXT_DATA__ renderizado via ScrapingBee', async () => {
    mockedFetch.mockResolvedValue({
      html: htmlWithNextData(NEXT_DATA_LECHE),
      status: 200,
      cost: 5,
    });

    const products = await adapter.fetchProducts();
    const byId = new Map(products.map((p) => [p.externalId, p]));

    expect(products.length).toBeGreaterThanOrEqual(2);

    expect(byId.get('C-001')).toMatchObject({
      externalId: 'C-001',
      name: 'Leche entera Carrefour brick 1L',
      brand: 'Carrefour',
      ean: '8410128000013',
      price: 0.95,
      onPromotion: false,
      packageUnit: 'LITER',
      packageSize: 1,
      imageUrl: 'https://static.carrefour.es/C-001.jpg',
    });

    expect(byId.get('C-002')).toMatchObject({
      externalId: 'C-002',
      brand: 'Hacendado',
      price: 5.1,
      previousPrice: 5.7,
      onPromotion: true,
      packageUnit: 'LITER',
      packageSize: 6,
    });
  });

  it('passa renderJs=true + waitFor=script#__NEXT_DATA__ ao scrapingbeeFetch', async () => {
    mockedFetch.mockResolvedValue({
      html: htmlWithNextData(NEXT_DATA_LECHE),
      status: 200,
      cost: 5,
    });
    await adapter.fetchProducts();
    const firstCall = mockedFetch.mock.calls[0];
    expect(firstCall[0]).toContain('https://www.carrefour.es/search?q=');
    expect(firstCall[1]).toMatchObject({
      renderJs: true,
      waitFor: 'script#__NEXT_DATA__',
    });
  });

  it('não aborta quando página falta __NEXT_DATA__', async () => {
    mockedFetch.mockResolvedValue({
      html: '<html><body>no next data here</body></html>',
      status: 200,
      cost: 5,
    });
    const products = await adapter.fetchProducts();
    expect(products).toEqual([]);
  });

  it('warn + continua quando scrapingbeeFetch throw', async () => {
    mockedFetch.mockRejectedValue(new Error('upstream 429'));
    const products = await adapter.fetchProducts();
    expect(products).toEqual([]);
  });

  it('pula produtos sem preço válido', async () => {
    mockedFetch.mockResolvedValue({
      html: htmlWithNextData({
        props: {
          pageProps: {
            searchResults: {
              products: [
                {
                  id: 'X-1',
                  display_name: 'Preço zero',
                  price_info: { current_price: 0 },
                },
                {
                  id: 'X-2',
                  display_name: 'ok',
                  price_info: { current_price: 2.5 },
                  package_info: { quantity: 1, unit_of_measure: 'ud' },
                },
              ],
            },
          },
        },
      }),
      status: 200,
      cost: 5,
    });

    const products = await adapter.fetchProducts();
    const ids = products.map((p) => p.externalId);
    expect(ids).toContain('X-2');
    expect(ids).not.toContain('X-1');
  });
});
