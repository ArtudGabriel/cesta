import { AldiAdapter } from './aldi.adapter';
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

// Fixtures observacionais capturadas S127 de aldi.es/es/ofertas.html.
// Mínimo viável: 2 tiles com shape real (brand opcional, promoção, pack).
const buildTile = (opts: {
  id: string;
  name: string;
  brand?: string;
  price: string;
  prevPrice?: string;
  promoLabel?: string;
  salesUnit?: string;
  image?: string;
}) => `
<div class="product-tile" tabindex="0" role="link">
  <div class="product-tile__image-section">
    <img data-testid="image" srcset="https://s7g10.scene7.com/is/image/aldinord/${opts.id}_1.webp 360w, ${opts.image || `https://s7g10.scene7.com/is/image/aldinord/${opts.id}_4.webp`} 1440w" src="${opts.image || `https://s7g10.scene7.com/is/image/aldinord/${opts.id}_4.webp`}"/>
  </div>
  <div class="product-tile__content">
    <p class="brand-name" data-testid="brand-name">${opts.brand || ''}</p>
    <h2 class="product-name" data-testid="product-name">${opts.name}</h2>
    <div data-testid="price-section">
      ${opts.promoLabel ? `<span data-testid="tag-promo-label">${opts.promoLabel}</span>` : ''}
      <div data-testid="tag-price-box">
        <div data-testid="tag-current-price">
          <span data-testid="tag-current-price-amount">${opts.price}</span>
        </div>
        ${opts.prevPrice ? `<div data-testid="tag-cross-price"><span data-testid="tag-cross-price-label"><span>${opts.prevPrice}</span></span></div>` : ''}
      </div>
      ${opts.salesUnit ? `<span data-testid="tag-sales-unit">${opts.salesUnit}</span>` : ''}
    </div>
  </div>
  <a title="${opts.name}" href="https://www.aldi.es/producto/${opts.name.toLowerCase().replace(/\s+/g, '-')}-${opts.id}.html" data-testid="product-tile-grid-product-tile-1" class="link product-tile__action">${opts.name}</a>
</div>`;

const OFERTAS_HTML = `<html><body>
${buildTile({ id: '600575300', name: 'Naranja', price: '3.79', prevPrice: '4.85', promoLabel: '-21%', salesUnit: '4 kg unidad' })}
${buildTile({ id: '123456', name: 'Leche entera brick', brand: 'Milsani', price: '0.89', salesUnit: '1 L unidad' })}
${buildTile({ id: '789012', name: 'Queso curado', price: '5.49', salesUnit: '500 g unidad' })}
${buildTile({ id: '555555', name: 'Cerveza pack 6', price: '3.49', salesUnit: 'pack 6 x 330 ml' })}
${buildTile({ id: 'ZERO', name: 'Preço zero', price: '0', salesUnit: '1 unidad' })}
</body></html>`;

describe('AldiAdapter', () => {
  let adapter: AldiAdapter;

  beforeEach(() => {
    adapter = new AldiAdapter();
    mockedPoliteFetchRaw.mockReset();
  });

  it('extrai product-tiles de /es/ofertas.html com preço, previousPrice e package', async () => {
    mockedPoliteFetchRaw.mockResolvedValue({
      body: OFERTAS_HTML,
      status: 200,
      setCookie: [],
    } as any);

    const products = await adapter.fetchProducts();
    const byId = new Map(products.map((p) => [p.externalId, p]));

    // 4 válidos (preço=0 filtrado) + 1 ZERO não-numérico id filtrado pelo URL_RE
    expect(products.length).toBe(4);

    expect(byId.get('600575300')).toMatchObject({
      externalId: '600575300',
      name: 'Naranja',
      brand: null,
      ean: null,
      price: 3.79,
      previousPrice: 4.85,
      onPromotion: true,
      packageUnit: 'KILOGRAM',
      comparisonUnit: 'KILOGRAM',
      packageSize: 4,
      imageUrl: expect.stringContaining('scene7.com/is/image/aldinord/600575300'),
      isAvailable: true,
    });

    expect(byId.get('123456')).toMatchObject({
      externalId: '123456',
      brand: 'Milsani',
      price: 0.89,
      previousPrice: null,
      onPromotion: false,
      packageUnit: 'LITER',
      packageSize: 1,
    });

    expect(byId.get('789012')).toMatchObject({
      externalId: '789012',
      price: 5.49,
      packageUnit: 'GRAM',
      comparisonUnit: 'KILOGRAM',
      packageSize: 500,
    });

    expect(byId.get('555555')).toMatchObject({
      externalId: '555555',
      price: 3.49,
      packageUnit: 'MILLILITER',
      comparisonUnit: 'LITER',
      packageSize: 1980, // pack 6 x 330 ml = 1980 ml (unit=ML, size raw)
    });
  });

  it('pula tiles sem URL válida ou preço inválido', async () => {
    const bad = `<html><body>
      <div class="product-tile">
        <h2 data-testid="product-name">Sem href</h2>
        <span data-testid="tag-current-price-amount">1.99</span>
      </div>
      <div class="product-tile">
        <a href="/es/producto/sem-id-aqui.html" class="product-tile__action">x</a>
        <h2 data-testid="product-name">URL sem id numeric</h2>
        <span data-testid="tag-current-price-amount">2.99</span>
      </div>
    </body></html>`;
    mockedPoliteFetchRaw.mockResolvedValue({
      body: bad,
      status: 200,
      setCookie: [],
    } as any);

    const products = await adapter.fetchProducts();
    expect(products).toEqual([]);
  });

  it('retorna [] quando ofertas.html retorna status não-200', async () => {
    mockedPoliteFetchRaw.mockResolvedValue({
      body: '',
      status: 503,
      setCookie: [],
    } as any);
    const products = await adapter.fetchProducts();
    expect(products).toEqual([]);
  });

  it('retorna [] quando politeFetchRaw lança', async () => {
    mockedPoliteFetchRaw.mockRejectedValue(new Error('network'));
    const products = await adapter.fetchProducts();
    expect(products).toEqual([]);
  });
});
