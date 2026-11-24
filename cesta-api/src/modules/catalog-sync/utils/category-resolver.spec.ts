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

    // Sprint 143 — long-tail bebidas
    ['Red Bull Energy Drink lata 250ml', 'bebidas'],
    ['Monster Energy Original 500ml', 'bebidas'],
    ['Powerade Isotonic Mountain Blast 500ml', 'bebidas'],
    ['Hacendado Iso drink naranja 1L', 'bebidas'],
    ['Furious energy drink 500ml', 'bebidas'],
    ['Aquarius Limón 1.5L', 'bebidas'],
    ['Schweppes tónica 1L', 'bebidas'],
    ['Bebida vegetal de avena 1L', 'bebidas'],
    ['Bebida de soja Pascual 1L', 'bebidas'],
    ['Granini zumo naranja 1L', 'bebidas'],
    ['Don Simon néctar piña 1L', 'bebidas'],
    ['Vermut Martini blanco 1L', 'bebidas'],

    // Sprint 143 — long-tail snacks + brands
    ['Doritos Tex Mex 150g', 'snacks-dulces'],
    ['Pringles Original 165g', 'snacks-dulces'],
    ['Cheetos Risketos 80g', 'snacks-dulces'],
    ['Kit Kat chocolate 4 barritas', 'snacks-dulces'],
    ['Oreo galletas pack 3', 'snacks-dulces'],
    ['Kinder Bueno 6 unidades', 'snacks-dulces'],
    ['Nutella crema cacao 400g', 'snacks-dulces'],

    // Sprint 143 — long-tail limpeza
    ['Fairy lavavajillas limón 750ml', 'limpieza'],
    ['Mistol clásico 1L', 'limpieza'],
    ['Cif crema limpiador 750ml', 'limpieza'],
    ['Don Limpio multiusos 1L', 'limpieza'],
    ['KH-7 quitamanchas 750ml', 'limpieza'],
    ['Sanytol desinfectante multiusos 750ml', 'limpieza'],
    ['Ambientador Febreze lavanda', 'limpieza'],
    ['Film transparente Albal 30m', 'limpieza'],

    // Sprint 143 — long-tail higiene
    ['Colgate Total pasta de dientes 75ml', 'higiene'],
    ['Oral-B cepillo dental medio', 'higiene'],
    ['Listerine Zero enjuague bucal 500ml', 'higiene'],
    ['Pantene Pro-V champú 500ml', 'higiene'],
    ['Head & Shoulders anti-caspa 400ml', 'higiene'],
    ['Nivea crema hidratante 200ml', 'higiene'],
    ['Dove gel de ducha 600ml', 'higiene'],
    ['Gillette Mach3 cuchillas', 'higiene'],

    // Sprint 143 — long-tail mascotas
    ['Royal Canin perro adulto 15kg', 'mascotas'],
    ['Purina Felix gato pack 12', 'mascotas'],
    ['Whiskas sabor atún 100g', 'mascotas'],
    ['Pedigree snack perro', 'mascotas'],
    ['Advance comida gato esterilizado 1.5kg', 'mascotas'],

    // Sprint 143 — long-tail congelados
    ['Nuggets de pollo Findus 400g', 'congelados'],
    ['Pizza congelada Casa Tarradellas', 'congelados'],
    ['Varitas de merluza Pescanova 480g', 'congelados'],
    ['Magnum almendra pack 3', 'congelados'],
    ['Cornetto clásico 4 unidades', 'congelados'],

    // Sprint 143 — long-tail bebês
    ['Dodot Sensitive talla 3 pack 108', 'bebes'],
    ['Pampers Baby-Dry talla 4', 'bebes'],
    ['Hero Baby papilla multicereales 500g', 'bebes'],
    ['Nutribén potito pollo con arroz', 'bebes'],
    ['Toallitas bebé Dodot pack 4', 'bebes'],

    // Sprint 143 — despensa long-tail
    ['Quinoa real 500g', 'despensa'],
    ['Avecrem caldo pollo 24 pastillas', 'despensa'],
    ['Gazpacho Alvalle 1L', 'despensa'],
    ['Lasaña bolognesa seca Gallo 500g', 'despensa'],
    ['Crema de calabaza listo consumir 500g', 'despensa'],

    // Sprint 144 — carne cortes + aves
    ['Morcillo de ternera 1kg', 'carne'],
    ['Jarrete de ternera 500g', 'carne'],
    ['Gallina entera para caldo 2kg', 'carne'],
    ['Compango asturiano chorizo + morcilla + lacón', 'carne'],
    ['Carpaccio de buey 80g', 'carne'],
    ['Vacuno picado 500g', 'carne'],
    ['Pechuga de pollo filetes 1kg', 'carne'],
    ['Alitas de pollo 1kg', 'carne'],
    ['Muslos de pollo bandeja 1kg', 'carne'],
    ['Costilla de cerdo bandeja 1kg', 'carne'],
    ['Lacón cocido Carrefour 200g', 'carne'],
    ['Secreto ibérico 400g', 'carne'],
    ['Lomo adobado 500g', 'carne'],
    ['Flamenquín de pollo 400g', 'carne'],
    ['Rabo de ternera 500g', 'carne'],
    ['Callos a la madrileña 500g', 'carne'],

    // Sprint 144 — private labels Mercadona
    ['Deliplus champú anti-caspa 500ml', 'higiene'],
    ['Deliplus crema hidratante facial 50ml', 'higiene'],
    ['Deliplus gel ducha 750ml', 'higiene'],
    ['Bosque Verde detergente líquido 2L', 'limpieza'],
    ['Bosqueverde lavavajillas gel 1L', 'limpieza'],
    ['Compy pañales talla 3 pack 54', 'bebes'],

    // Sprint 145 — ultracongelados + pizza + marisco congelado
    ['Pizza Hacendado jamón y queso ultracongelada', 'congelados'],
    ['Pizza Casa Tarradellas 400g', 'congelados'],
    ['Bogavante entero ultracongelado 400g', 'congelados'],
    ['Cigalas ultracongeladas bandeja 300g', 'congelados'],
    ['Croquetas de jamón Hacendado congeladas 500g', 'congelados'],
    ['Base de pizza fresca Hacendado 2 unidades', 'congelados'],
    ['Masa de pizza congelada Buitoni', 'congelados'],
    ['Precongelado panadería mini croissant', 'congelados'],
    // Sprint 145 — hielo
    ['Bolsa de hielo cubitos 2kg', 'bebidas'],
    ['Cubitos de hielo artesanal 1kg', 'bebidas'],
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
