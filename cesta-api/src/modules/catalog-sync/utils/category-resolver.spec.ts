import { resolveCategorySlug } from './category-resolver';

describe('resolveCategorySlug', () => {
  const cases: Array<[string, string | null]> = [
    ['Leche entera Hacendado brick 1 L', 'lacteos'],
    ['Yogur natural Danone pack 4x125g', 'lacteos'],
    ['Queso Manchego curado 200g', 'lacteos'],
    ['Pan integral Froiz 500g', 'pan-bolleria'],
    ['Galletas María pack 3', 'pan-bolleria'],
    ['Cereales Kellogg\'s Corn Flakes 500g', 'desayuno-cereales'],
    ['Café soluble Nescafé 200g', 'desayuno-cereales'],
    ['Chuletón de ternera 500g', 'carne'],
    ['Jamón serrano 100g', 'carne'],
    ['Pollo entero kg', 'carne'],
    ['Merluza fresca fileteada 500g', 'pescado'],
    ['Atún claro en aceite oliva 3x80g', 'pescado'],
    ['Manzana Golden kg', 'frutas-verduras'],
    ['Tomate pera kg', 'frutas-verduras'],
    ['Lechuga iceberg unidad', 'frutas-verduras'],
    ['Agua mineral San Benedetto 1.5L', 'bebidas'],
    ['Coca-Cola Zero 2L', 'bebidas'],
    ['Cerveza Mahou 6x330ml', 'bebidas'],
    ['Aceite de oliva virgen extra 1L', 'despensa'],
    ['Arroz redondo 1kg', 'despensa'],
    ['Lenteja pardina 500g', 'despensa'],
    ['Patatas fritas Lay\'s 200g', 'snacks-dulces'],
    ['Chocolate con leche Nestlé 125g', 'snacks-dulces'],
    ['Turrón de Jijona 250g', 'snacks-dulces'],
    ['Pizza congelada Dr. Oetker', 'congelados'],
    ['Helado vainilla 500ml', 'congelados'],
    ['Detergente Ariel 2L', 'limpieza'],
    ['Papel higiénico 12 rollos', 'limpieza'],
    ['Champú Pantene 400ml', 'higiene'],
    ['Desodorante Rexona', 'higiene'],
    ['Pañales Dodot talla 4', 'bebes'],
    ['Pienso perro adulto 12kg', 'mascotas'],
    ['Mayonesa Hellmann\'s 450ml', 'salsas-conservas'],
    ['Produto sem categoria clara xyz zzz', null],
  ];

  it.each(cases)('normaliza "%s" → %s', (input, expected) => {
    expect(resolveCategorySlug(input)).toBe(expected);
  });

  it('respeita hint do adapter quando presente', () => {
    expect(
      resolveCategorySlug('Produto xyz sem match', 'Carnicería'),
    ).toBe('carne');
  });

  it('diacritics case-insensitive', () => {
    expect(resolveCategorySlug('LECHE DESNATADA 1L')).toBe('lacteos');
    expect(resolveCategorySlug('Atún Claro')).toBe('pescado');
  });
});
