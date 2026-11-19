import { CarrefourAdapter } from './carrefour.adapter';
import { puppeteerFetch, closePuppeteerBrowser } from '../utils/puppeteer-fetch';

jest.mock('../utils/puppeteer-fetch', () => ({
  puppeteerFetch: jest.fn(),
  closePuppeteerBrowser: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../utils/user-agents', () => ({ pickUserAgent: () => 'test-ua' }));

const mockedPuppeteer = puppeteerFetch as jest.MockedFunction<typeof puppeteerFetch>;
const mockedClose = closePuppeteerBrowser as jest.MockedFunction<
  typeof closePuppeteerBrowser
>;

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

describe('CarrefourAdapter (Puppeteer S128)', () => {
  let adapter: CarrefourAdapter;

  beforeEach(() => {
    adapter = new CarrefourAdapter();
    mockedPuppeteer.mockReset();
    mockedClose.mockReset();
    mockedClose.mockResolvedValue(undefined);
  });

  it('extrai produtos de __NEXT_DATA__ renderizado via Puppeteer', async () => {
    mockedPuppeteer.mockResolvedValue({
      html: htmlWithNextData(NEXT_DATA_LECHE),
      finalUrl: 'https://www.carrefour.es/search?q=leche',
      status: 200,
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

  it('não aborta quando página falta __NEXT_DATA__', async () => {
    mockedPuppeteer.mockResolvedValue({
      html: '<html><body>no next data here</body></html>',
      finalUrl: 'https://www.carrefour.es/search?q=x',
      status: 200,
    });
    const products = await adapter.fetchProducts();
    expect(products).toEqual([]);
  });

  it('sempre chama closePuppeteerBrowser no finally', async () => {
    mockedPuppeteer.mockRejectedValue(new Error('chromium crashed'));
    await adapter.fetchProducts();
    expect(mockedClose).toHaveBeenCalledTimes(1);
  });

  it('pula produtos sem preço válido', async () => {
    mockedPuppeteer.mockResolvedValue({
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
      finalUrl: '',
      status: 200,
    });

    const products = await adapter.fetchProducts();
    const ids = products.map((p) => p.externalId);
    expect(ids).toContain('X-2');
    expect(ids).not.toContain('X-1');
  });
});
