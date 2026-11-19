import { LidlAdapter } from './lidl.adapter';
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

// HTML-encoded JSON mimicking real LIDL /q/search response (capturado S126).
// Shape observado:
//   {"erpNumber":"100408539002","fullTitle":"...","image":"...","price":{"price":17.99,"displayedCurrency":"€",...}}
// Produtos múltiplos aparecem em array, cada com erpNumber distinto.
const encode = (s: string) => s.replace(/"/g, '&quot;');

const LECHE_HTML = encode(`
[
  {"erpNumber":"100408539002","flashSales":false,"fullTitle":"SILVERCREST® Espumador de leche »SMSP 500 A1« (Negro)","image":"https://www.lidl.es/assets/gcpa.jpg","keyfacts":{"analyticsCategory":"Categorías/Cocina/Café y compañía"},"price":{"displayedCurrency":"€","price":17.99,"tax":"21"}},
  {"erpNumber":"11001765","flashSales":false,"fullTitle":"FIN CARRÉ Chocolate con leche 200g","image":"https://www.lidl.es/assets/gcp98.png","keyfacts":{"analyticsCategory":"Categorías/Chocolate"},"price":{"displayedCurrency":"€","price":1.49}},
  {"erpNumber":"22223333","fullTitle":"Leche entera pack 6 x 1 L Hacendado","image":"https://www.lidl.es/assets/gcp6pack.jpg","price":{"displayedCurrency":"€","price":5.1},"brand":"Hacendado"}
]
`);

const YOGUR_HTML = encode(`
[
  {"erpNumber":"44445555","fullTitle":"Yogur natural 500 g","image":"https://www.lidl.es/assets/gcpyog.jpg","price":{"displayedCurrency":"€","price":1.2}}
]
`);

const INVALID_HTML = encode(`
[
  {"erpNumber":"99999999","fullTitle":"Preço zero","price":{"price":0}},
  {"erpNumber":"88888888","fullTitle":"Preço missing","price":{"displayedCurrency":"€"}}
]
`);

describe('LidlAdapter', () => {
  let adapter: LidlAdapter;

  beforeEach(() => {
    adapter = new LidlAdapter();
    mockedPoliteFetchRaw.mockReset();
  });

  it('extrai produtos JSON HTML-encoded de /q/search', async () => {
    mockedPoliteFetchRaw.mockImplementation((url: string) => {
      if (url.includes('q=leche'))
        return Promise.resolve({ body: LECHE_HTML, status: 200, setCookie: [] }) as any;
      if (url.includes('q=yogur'))
        return Promise.resolve({ body: YOGUR_HTML, status: 200, setCookie: [] }) as any;
      return Promise.resolve({ body: '[]', status: 200, setCookie: [] }) as any;
    });

    const products = await adapter.fetchProducts();
    const byId = new Map(products.map((p) => [p.externalId, p]));

    expect(products.length).toBeGreaterThanOrEqual(4);

    expect(byId.get('100408539002')).toMatchObject({
      externalId: '100408539002',
      name: 'SILVERCREST® Espumador de leche »SMSP 500 A1« (Negro)',
      price: 17.99,
      imageUrl: 'https://www.lidl.es/assets/gcpa.jpg',
      ean: null,
      onPromotion: false,
    });
    // Brand from title heuristic (SILVERCREST all caps)
    expect(byId.get('100408539002')?.brand).toMatch(/SILVERCREST/i);

    expect(byId.get('11001765')).toMatchObject({
      externalId: '11001765',
      price: 1.49,
      packageUnit: 'GRAM',
      packageSize: 200,
    });

    expect(byId.get('22223333')).toMatchObject({
      externalId: '22223333',
      brand: 'Hacendado',
      price: 5.1,
      packageUnit: 'LITER',
      packageSize: 6, // pack 6 x 1 L
    });

    expect(byId.get('44445555')).toMatchObject({
      externalId: '44445555',
      price: 1.2,
      packageUnit: 'GRAM',
      packageSize: 500,
    });
  });

  it('pula produtos sem preço válido', async () => {
    mockedPoliteFetchRaw.mockResolvedValue({
      body: INVALID_HTML,
      status: 200,
      setCookie: [],
    } as any);

    const products = await adapter.fetchProducts();
    const ids = products.map((p) => p.externalId);
    expect(ids).not.toContain('99999999');
    expect(ids).not.toContain('88888888');
  });

  it('dedupa entre queries', async () => {
    mockedPoliteFetchRaw.mockResolvedValue({
      body: LECHE_HTML,
      status: 200,
      setCookie: [],
    } as any);

    const products = await adapter.fetchProducts();
    const unique = new Set(products.map((p) => p.externalId));
    expect(products.length).toBe(unique.size);
    expect(unique.has('100408539002')).toBe(true);
  });

  it('não aborta quando query lança', async () => {
    let call = 0;
    mockedPoliteFetchRaw.mockImplementation(() => {
      call += 1;
      if (call === 1) return Promise.reject(new Error('timeout'));
      return Promise.resolve({ body: YOGUR_HTML, status: 200, setCookie: [] }) as any;
    });

    const products = await adapter.fetchProducts();
    expect(products.find((p) => p.externalId === '44445555')).toBeDefined();
  });

  it('retorna [] quando todas queries vazias', async () => {
    mockedPoliteFetchRaw.mockResolvedValue({
      body: '[]',
      status: 200,
      setCookie: [],
    } as any);
    const products = await adapter.fetchProducts();
    expect(products).toEqual([]);
  });
});
