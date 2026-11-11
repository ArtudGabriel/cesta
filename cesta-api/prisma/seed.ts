import {
  MeasureUnit,
  Prisma,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

// ──────────────────────────────────────────────
// Supermarkets
// ──────────────────────────────────────────────
const SUPERMARKETS = [
  { slug: 'mercadona', name: 'Mercadona', color: '#009D58' },
  { slug: 'carrefour', name: 'Carrefour', color: '#004F9F' },
  { slug: 'alcampo',   name: 'Alcampo',   color: '#E2001A' },
  { slug: 'lidl',      name: 'LIDL',      color: '#FFD100' },
  { slug: 'froiz',     name: 'Froiz',     color: '#4BA82E' },
  { slug: 'dia',       name: 'DIA',       color: '#D0021B' },
  { slug: 'aldi',      name: 'Aldi',      color: '#003087' },
];

// ──────────────────────────────────────────────
// Categorias (tree 2 níveis)
// ──────────────────────────────────────────────
interface CategorySeed {
  slug: string;
  nameEs: string;
  namePt: string;
  order: number;
  children?: CategorySeed[];
}

const CATEGORIES: CategorySeed[] = [
  { slug: 'lacteos', nameEs: 'Lácteos y huevos', namePt: 'Laticínios e ovos', order: 1 },
  { slug: 'pan-bolleria', nameEs: 'Pan y bollería', namePt: 'Pão e bolos', order: 2 },
  { slug: 'carne', nameEs: 'Carnicería', namePt: 'Carnes', order: 3 },
  { slug: 'pescado', nameEs: 'Pescadería', namePt: 'Peixes', order: 4 },
  { slug: 'frutas-verduras', nameEs: 'Frutas y verduras', namePt: 'Frutas e verduras', order: 5 },
  { slug: 'bebidas', nameEs: 'Bebidas', namePt: 'Bebidas', order: 6 },
  { slug: 'despensa', nameEs: 'Despensa', namePt: 'Mercearia', order: 7 },
  { slug: 'congelados', nameEs: 'Congelados', namePt: 'Congelados', order: 8 },
  { slug: 'limpieza', nameEs: 'Limpieza', namePt: 'Limpeza', order: 9 },
  { slug: 'higiene', nameEs: 'Higiene y belleza', namePt: 'Higiene e beleza', order: 10 },
  { slug: 'bebes', nameEs: 'Bebés', namePt: 'Bebês', order: 11 },
  { slug: 'mascotas', nameEs: 'Mascotas', namePt: 'Pets', order: 12 },
];

// ──────────────────────────────────────────────
// Produtos amostra
// ──────────────────────────────────────────────
interface ProductSeed {
  name: string;
  brand?: string;
  categorySlug: string;
  packageSize: number;
  packageUnit: MeasureUnit;
  comparisonUnit: MeasureUnit;
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  sugar?: number;
  fiber?: number;
  salt?: number;
  tags?: Partial<{
    isVegan: boolean;
    isVegetarian: boolean;
    isGlutenFree: boolean;
    isLactoseFree: boolean;
  }>;
  prices: Partial<Record<string, { price: number; onPromotion?: boolean }>>;
}

const PRODUCTS: ProductSeed[] = [
  // Lácteos
  {
    name: 'Leche entera brik 1L',
    brand: 'Hacendado',
    categorySlug: 'lacteos',
    packageSize: 1, packageUnit: 'LITER', comparisonUnit: 'LITER',
    calories: 64, protein: 3.2, fat: 3.6, carbs: 4.7, sugar: 4.7, salt: 0.1,
    tags: { isVegetarian: true },
    prices: { mercadona: { price: 0.95 }, carrefour: { price: 1.05 }, alcampo: { price: 1.02 }, lidl: { price: 0.93 }, froiz: { price: 1.08 }, dia: { price: 1.00 }, aldi: { price: 0.94 } },
  },
  {
    name: 'Yogur natural pack 4x125g',
    brand: 'Danone',
    categorySlug: 'lacteos',
    packageSize: 0.5, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 59, protein: 4.5, fat: 2.8, carbs: 4.0,
    tags: { isVegetarian: true },
    prices: { mercadona: { price: 1.85 }, carrefour: { price: 2.10, onPromotion: true }, alcampo: { price: 2.05 }, lidl: { price: 1.75 }, froiz: { price: 2.15 }, dia: { price: 1.95 }, aldi: { price: 1.70 } },
  },
  {
    name: 'Queso rallado mozzarella 200g',
    brand: 'Hacendado',
    categorySlug: 'lacteos',
    packageSize: 0.2, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 280, protein: 22, fat: 21, carbs: 1,
    tags: { isVegetarian: true, isGlutenFree: true },
    prices: { mercadona: { price: 1.80 }, carrefour: { price: 2.20 }, alcampo: { price: 2.10 }, lidl: { price: 1.75 }, froiz: { price: 2.30 }, dia: { price: 2.00 }, aldi: { price: 1.70 } },
  },
  {
    name: 'Huevos frescos L docena',
    brand: 'Hacendado',
    categorySlug: 'lacteos',
    packageSize: 12, packageUnit: 'UNIT', comparisonUnit: 'UNIT',
    calories: 143, protein: 12.6, fat: 9.9, carbs: 0.7,
    tags: { isVegetarian: true, isGlutenFree: true, isLactoseFree: true },
    prices: { mercadona: { price: 2.95 }, carrefour: { price: 3.50 }, alcampo: { price: 3.30 }, lidl: { price: 2.85 }, froiz: { price: 3.45 }, dia: { price: 3.10 }, aldi: { price: 2.80 } },
  },

  // Pan
  {
    name: 'Pan de molde integral 460g',
    brand: 'Bimbo',
    categorySlug: 'pan-bolleria',
    packageSize: 0.46, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 245, protein: 10, fat: 3.5, carbs: 42, fiber: 7, salt: 1.1,
    tags: { isVegetarian: true, isVegan: true },
    prices: { mercadona: { price: 1.55 }, carrefour: { price: 2.10 }, alcampo: { price: 1.95 }, lidl: { price: 1.50 }, froiz: { price: 2.00 }, dia: { price: 1.85 }, aldi: { price: 1.45 } },
  },
  {
    name: 'Pan de barra 250g',
    brand: 'Marca blanca',
    categorySlug: 'pan-bolleria',
    packageSize: 0.25, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 265, protein: 9, fat: 1.5, carbs: 52, salt: 1.2,
    tags: { isVegetarian: true, isVegan: true },
    prices: { mercadona: { price: 0.40 }, carrefour: { price: 0.55 }, alcampo: { price: 0.50 }, lidl: { price: 0.39 }, froiz: { price: 0.60 }, dia: { price: 0.45 }, aldi: { price: 0.38 } },
  },

  // Carne
  {
    name: 'Pechuga de pollo fileteada 1kg',
    brand: 'Marca blanca',
    categorySlug: 'carne',
    packageSize: 1, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 165, protein: 31, fat: 3.6,
    tags: { isGlutenFree: true, isLactoseFree: true },
    prices: { mercadona: { price: 5.95 }, carrefour: { price: 7.20 }, alcampo: { price: 6.85 }, lidl: { price: 5.85 }, froiz: { price: 7.10 }, dia: { price: 6.50 }, aldi: { price: 5.70 } },
  },
  {
    name: 'Carne picada mixta 500g',
    brand: 'Marca blanca',
    categorySlug: 'carne',
    packageSize: 0.5, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 220, protein: 18, fat: 16,
    tags: { isGlutenFree: true, isLactoseFree: true },
    prices: { mercadona: { price: 3.20 }, carrefour: { price: 4.10 }, alcampo: { price: 3.95 }, lidl: { price: 3.15 }, froiz: { price: 4.05 }, dia: { price: 3.60 }, aldi: { price: 3.10 } },
  },
  {
    name: 'Jamón york lonchas 200g',
    brand: 'Campofrío',
    categorySlug: 'carne',
    packageSize: 0.2, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 115, protein: 17, fat: 4,
    tags: { isGlutenFree: true, isLactoseFree: true },
    prices: { mercadona: { price: 2.10 }, carrefour: { price: 2.65 }, alcampo: { price: 2.55 }, lidl: { price: 2.05 }, froiz: { price: 2.70 }, dia: { price: 2.30 }, aldi: { price: 2.00 } },
  },

  // Pescado
  {
    name: 'Salmón fresco sin piel 500g',
    brand: 'Marca blanca',
    categorySlug: 'pescado',
    packageSize: 0.5, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 208, protein: 20, fat: 13,
    tags: { isGlutenFree: true, isLactoseFree: true },
    prices: { mercadona: { price: 7.95 }, carrefour: { price: 9.50, onPromotion: true }, alcampo: { price: 9.00 }, lidl: { price: 7.85 }, froiz: { price: 9.70 }, dia: { price: 8.50 }, aldi: { price: 7.70 } },
  },
  {
    name: 'Atún en aceite pack 3x80g',
    brand: 'Isabel',
    categorySlug: 'pescado',
    packageSize: 0.24, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 189, protein: 25, fat: 10,
    tags: { isGlutenFree: true, isLactoseFree: true },
    prices: { mercadona: { price: 2.15 }, carrefour: { price: 2.80 }, alcampo: { price: 2.65 }, lidl: { price: 2.05 }, froiz: { price: 2.75 }, dia: { price: 2.40 }, aldi: { price: 2.00 } },
  },

  // Frutas y verduras
  {
    name: 'Plátano Canarias 1kg',
    categorySlug: 'frutas-verduras',
    packageSize: 1, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 89, protein: 1.1, carbs: 23, sugar: 12,
    tags: { isVegan: true, isVegetarian: true, isGlutenFree: true, isLactoseFree: true },
    prices: { mercadona: { price: 1.69 }, carrefour: { price: 1.95 }, alcampo: { price: 1.85 }, lidl: { price: 1.65 }, froiz: { price: 2.05 }, dia: { price: 1.80 }, aldi: { price: 1.60 } },
  },
  {
    name: 'Tomate pera 1kg',
    categorySlug: 'frutas-verduras',
    packageSize: 1, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 18, protein: 0.9, carbs: 3.9, sugar: 2.6,
    tags: { isVegan: true, isVegetarian: true, isGlutenFree: true, isLactoseFree: true },
    prices: { mercadona: { price: 1.49 }, carrefour: { price: 1.85 }, alcampo: { price: 1.75 }, lidl: { price: 1.45 }, froiz: { price: 1.90 }, dia: { price: 1.60 }, aldi: { price: 1.40 } },
  },
  {
    name: 'Patatas saco 2kg',
    categorySlug: 'frutas-verduras',
    packageSize: 2, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 77, protein: 2, carbs: 17,
    tags: { isVegan: true, isVegetarian: true, isGlutenFree: true, isLactoseFree: true },
    prices: { mercadona: { price: 1.89 }, carrefour: { price: 2.30 }, alcampo: { price: 2.15 }, lidl: { price: 1.85 }, froiz: { price: 2.40 }, dia: { price: 2.05 }, aldi: { price: 1.80 } },
  },
  {
    name: 'Manzana Golden 1kg',
    categorySlug: 'frutas-verduras',
    packageSize: 1, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 52, protein: 0.3, carbs: 14, sugar: 10,
    tags: { isVegan: true, isVegetarian: true, isGlutenFree: true, isLactoseFree: true },
    prices: { mercadona: { price: 1.65 }, carrefour: { price: 1.95 }, alcampo: { price: 1.85 }, lidl: { price: 1.60 }, froiz: { price: 2.00 }, dia: { price: 1.75 }, aldi: { price: 1.55 } },
  },

  // Bebidas
  {
    name: 'Agua mineral pack 6x1.5L',
    brand: 'Font Vella',
    categorySlug: 'bebidas',
    packageSize: 9, packageUnit: 'LITER', comparisonUnit: 'LITER',
    tags: { isVegan: true, isVegetarian: true, isGlutenFree: true, isLactoseFree: true },
    prices: { mercadona: { price: 2.95 }, carrefour: { price: 3.95 }, alcampo: { price: 3.75 }, lidl: { price: 2.85 }, froiz: { price: 4.05 }, dia: { price: 3.45 }, aldi: { price: 2.80 } },
  },
  {
    name: 'Coca-Cola Original 2L',
    brand: 'Coca-Cola',
    categorySlug: 'bebidas',
    packageSize: 2, packageUnit: 'LITER', comparisonUnit: 'LITER',
    calories: 42, carbs: 10.6, sugar: 10.6,
    tags: { isVegan: true, isVegetarian: true, isGlutenFree: true, isLactoseFree: true },
    prices: { mercadona: { price: 2.15 }, carrefour: { price: 2.45 }, alcampo: { price: 2.30 }, lidl: { price: 2.10, onPromotion: true }, froiz: { price: 2.55 }, dia: { price: 2.25 }, aldi: { price: 2.05 } },
  },
  {
    name: 'Cerveza rubia pack 12x330ml',
    brand: 'Mahou',
    categorySlug: 'bebidas',
    packageSize: 3.96, packageUnit: 'LITER', comparisonUnit: 'LITER',
    tags: { isVegetarian: true, isGlutenFree: false, isLactoseFree: true },
    prices: { mercadona: { price: 5.95 }, carrefour: { price: 7.20 }, alcampo: { price: 6.85 }, lidl: { price: 5.80 }, froiz: { price: 7.30 }, dia: { price: 6.50 }, aldi: { price: 5.70 } },
  },

  // Despensa
  {
    name: 'Aceite oliva virgen extra 1L',
    brand: 'Carbonell',
    categorySlug: 'despensa',
    packageSize: 1, packageUnit: 'LITER', comparisonUnit: 'LITER',
    calories: 884, fat: 100,
    tags: { isVegan: true, isVegetarian: true, isGlutenFree: true, isLactoseFree: true },
    prices: { mercadona: { price: 7.45 }, carrefour: { price: 8.95, onPromotion: true }, alcampo: { price: 8.50 }, lidl: { price: 7.35 }, froiz: { price: 9.10 }, dia: { price: 8.20 }, aldi: { price: 7.25 } },
  },
  {
    name: 'Arroz largo 1kg',
    brand: 'La Fallera',
    categorySlug: 'despensa',
    packageSize: 1, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 356, protein: 7, fat: 0.6, carbs: 79,
    tags: { isVegan: true, isVegetarian: true, isGlutenFree: true, isLactoseFree: true },
    prices: { mercadona: { price: 1.35 }, carrefour: { price: 1.75 }, alcampo: { price: 1.65 }, lidl: { price: 1.30 }, froiz: { price: 1.80 }, dia: { price: 1.50 }, aldi: { price: 1.25 } },
  },
  {
    name: 'Pasta espaguetis 500g',
    brand: 'Gallo',
    categorySlug: 'despensa',
    packageSize: 0.5, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 358, protein: 12, fat: 1.5, carbs: 74,
    tags: { isVegan: true, isVegetarian: true, isLactoseFree: true },
    prices: { mercadona: { price: 0.85 }, carrefour: { price: 1.15 }, alcampo: { price: 1.05 }, lidl: { price: 0.80 }, froiz: { price: 1.20 }, dia: { price: 0.95 }, aldi: { price: 0.75 } },
  },
  {
    name: 'Azúcar blanco 1kg',
    brand: 'Azucarera',
    categorySlug: 'despensa',
    packageSize: 1, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 400, carbs: 100, sugar: 100,
    tags: { isVegan: true, isVegetarian: true, isGlutenFree: true, isLactoseFree: true },
    prices: { mercadona: { price: 1.05 }, carrefour: { price: 1.35 }, alcampo: { price: 1.25 }, lidl: { price: 1.00 }, froiz: { price: 1.40 }, dia: { price: 1.15 }, aldi: { price: 0.95 } },
  },

  // Congelados
  {
    name: 'Pizza margarita congelada 350g',
    brand: 'Hacendado',
    categorySlug: 'congelados',
    packageSize: 0.35, packageUnit: 'KILOGRAM', comparisonUnit: 'KILOGRAM',
    calories: 240, protein: 10, fat: 8, carbs: 30,
    tags: { isVegetarian: true },
    prices: { mercadona: { price: 1.95 }, carrefour: { price: 2.65 }, alcampo: { price: 2.50 }, lidl: { price: 1.90 }, froiz: { price: 2.80 }, dia: { price: 2.30 }, aldi: { price: 1.85 } },
  },

  // Limpieza
  {
    name: 'Detergente líquido 40 lavados',
    brand: 'Ariel',
    categorySlug: 'limpieza',
    packageSize: 2.2, packageUnit: 'LITER', comparisonUnit: 'LITER',
    prices: { mercadona: { price: 8.95 }, carrefour: { price: 11.50, onPromotion: true }, alcampo: { price: 10.75 }, lidl: { price: 8.80 }, froiz: { price: 11.80 }, dia: { price: 10.20 }, aldi: { price: 8.70 } },
  },
  {
    name: 'Papel higiénico 12 rollos',
    brand: 'Scottex',
    categorySlug: 'limpieza',
    packageSize: 12, packageUnit: 'UNIT', comparisonUnit: 'UNIT',
    prices: { mercadona: { price: 4.95 }, carrefour: { price: 6.50 }, alcampo: { price: 6.20 }, lidl: { price: 4.85 }, froiz: { price: 6.75 }, dia: { price: 5.80 }, aldi: { price: 4.75 } },
  },

  // Higiene
  {
    name: 'Champú 400ml',
    brand: 'H&S',
    categorySlug: 'higiene',
    packageSize: 0.4, packageUnit: 'LITER', comparisonUnit: 'LITER',
    prices: { mercadona: { price: 2.85 }, carrefour: { price: 4.25 }, alcampo: { price: 3.95 }, lidl: { price: 2.80 }, froiz: { price: 4.35 }, dia: { price: 3.60 }, aldi: { price: 2.75 } },
  },
  {
    name: 'Pasta dentífrica 75ml',
    brand: 'Colgate',
    categorySlug: 'higiene',
    packageSize: 0.075, packageUnit: 'LITER', comparisonUnit: 'LITER',
    prices: { mercadona: { price: 1.35 }, carrefour: { price: 2.10 }, alcampo: { price: 1.95 }, lidl: { price: 1.30 }, froiz: { price: 2.20 }, dia: { price: 1.75 }, aldi: { price: 1.25 } },
  },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function seedSupermarkets() {
  for (const sm of SUPERMARKETS) {
    await prisma.supermarket.upsert({
      where: { slug: sm.slug },
      create: sm,
      update: {}, // idempotente: não sobrescreve configs em runtime
    });
  }
  console.log(`✓ ${SUPERMARKETS.length} supermarkets`);
}

async function seedCategories(nodes: CategorySeed[], parentId: string | null = null) {
  for (const node of nodes) {
    const cat = await prisma.category.upsert({
      where: { slug: node.slug },
      create: {
        slug: node.slug,
        nameEs: node.nameEs,
        namePt: node.namePt,
        order: node.order,
        parentId,
      },
      update: {},
    });
    if (node.children?.length) {
      await seedCategories(node.children, cat.id);
    }
  }
}

async function seedProducts() {
  const supermarkets = await prisma.supermarket.findMany();
  const bySlug = new Map(supermarkets.map((s) => [s.slug, s]));
  const categories = await prisma.category.findMany();
  const catBySlug = new Map(categories.map((c) => [c.slug, c]));

  for (const p of PRODUCTS) {
    const normalizedName = slugify(`${p.brand ?? ''} ${p.name}`);
    const product = await prisma.product.upsert({
      where: { normalizedName },
      create: {
        name: p.name,
        normalizedName,
        brand: p.brand ?? null,
        categoryId: catBySlug.get(p.categorySlug)?.id ?? null,
        packageSize: new Prisma.Decimal(p.packageSize),
        packageUnit: p.packageUnit,
        comparisonUnit: p.comparisonUnit,
        nutritionPer: p.calories != null ? new Prisma.Decimal(100) : null,
        calories: p.calories ? new Prisma.Decimal(p.calories) : null,
        protein: p.protein ? new Prisma.Decimal(p.protein) : null,
        fat: p.fat ? new Prisma.Decimal(p.fat) : null,
        carbs: p.carbs ? new Prisma.Decimal(p.carbs) : null,
        sugar: p.sugar ? new Prisma.Decimal(p.sugar) : null,
        salt: p.salt ? new Prisma.Decimal(p.salt) : null,
        isVegan: p.tags?.isVegan ?? false,
        isVegetarian: p.tags?.isVegetarian ?? false,
        isGlutenFree: p.tags?.isGlutenFree ?? false,
        isLactoseFree: p.tags?.isLactoseFree ?? false,
      },
      update: {},
    });

    for (const [slug, priceData] of Object.entries(p.prices)) {
      if (!priceData) continue;
      const sm = bySlug.get(slug);
      if (!sm) continue;
      await prisma.productPrice.upsert({
        where: {
          productId_supermarketId: { productId: product.id, supermarketId: sm.id },
        },
        create: {
          productId: product.id,
          supermarketId: sm.id,
          currentPrice: new Prisma.Decimal(priceData.price),
          onPromotion: priceData.onPromotion ?? false,
          source: 'seed',
          lastSyncedAt: new Date(),
        },
        update: {
          currentPrice: new Prisma.Decimal(priceData.price),
          onPromotion: priceData.onPromotion ?? false,
          lastSyncedAt: new Date(),
          isStale: false,
        },
      });
    }
  }

  console.log(`✓ ${PRODUCTS.length} products + prices`);
}

// ──────────────────────────────────────────────
// Dietary questions (Cesta Familiar)
// ──────────────────────────────────────────────
const DIETARY_QUESTIONS: Array<{
  key: string;
  labelEs: string;
  labelPt: string;
  type: 'boolean' | 'choice';
  options?: Array<{ value: string; labelEs: string; labelPt: string }>;
  category?: string;
  order: number;
}> = [
  { key: 'eats_meat', labelEs: '¿La familia come carne?', labelPt: 'A família come carne?', type: 'boolean', category: 'protein', order: 1 },
  { key: 'eats_fish', labelEs: '¿Come pescado?', labelPt: 'Come peixe?', type: 'boolean', category: 'protein', order: 2 },
  { key: 'eats_dairy', labelEs: '¿Consume lácteos?', labelPt: 'Consome laticínios?', type: 'boolean', category: 'dairy', order: 3 },
  { key: 'eats_bread', labelEs: '¿Consume pan regularmente?', labelPt: 'Consome pão regularmente?', type: 'boolean', category: 'grains', order: 4 },
  { key: 'lactose_intolerant', labelEs: '¿Alguien tiene intolerancia a la lactosa?', labelPt: 'Alguém tem intolerância à lactose?', type: 'boolean', category: 'restriction', order: 5 },
  { key: 'gluten_free', labelEs: '¿Alguien evita el gluten?', labelPt: 'Alguém evita glúten?', type: 'boolean', category: 'restriction', order: 6 },
  { key: 'vegan', labelEs: '¿Siguen una dieta vegana?', labelPt: 'Seguem dieta vegana?', type: 'boolean', category: 'diet', order: 7 },
  { key: 'vegetarian', labelEs: '¿Siguen una dieta vegetariana?', labelPt: 'Seguem dieta vegetariana?', type: 'boolean', category: 'diet', order: 8 },
  { key: 'drinks_alcohol', labelEs: '¿Consumen alcohol (vino, cerveza)?', labelPt: 'Consomem álcool (vinho, cerveja)?', type: 'boolean', category: 'beverages', order: 9 },
  {
    key: 'fruits_veggies_frequency',
    labelEs: '¿Con qué frecuencia comen frutas y verduras?',
    labelPt: 'Com que frequência comem frutas e verduras?',
    type: 'choice',
    options: [
      { value: 'daily', labelEs: 'Todos los días', labelPt: 'Todos os dias' },
      { value: 'weekly', labelEs: 'Varias veces por semana', labelPt: 'Várias vezes por semana' },
      { value: 'rarely', labelEs: 'Pocas veces', labelPt: 'Raramente' },
    ],
    category: 'produce',
    order: 10,
  },
  { key: 'eats_out_often', labelEs: '¿Comen fuera de casa con frecuencia?', labelPt: 'Comem fora de casa com frequência?', type: 'boolean', category: 'lifestyle', order: 11 },
  { key: 'has_pets', labelEs: '¿Tienen mascotas en casa?', labelPt: 'Têm pets em casa?', type: 'boolean', category: 'pets', order: 12 },
];

async function seedDietaryQuestions() {
  for (const q of DIETARY_QUESTIONS) {
    await prisma.dietaryQuestion.upsert({
      where: { key: q.key },
      create: {
        key: q.key,
        labelEs: q.labelEs,
        labelPt: q.labelPt,
        type: q.type,
        options: q.options ?? Prisma.DbNull,
        category: q.category,
        order: q.order,
      },
      update: {},
    });
  }
  console.log(`✓ ${DIETARY_QUESTIONS.length} dietary questions`);
}

async function main() {
  console.log('Seeding Cesta…');
  await seedSupermarkets();
  await seedCategories(CATEGORIES);
  console.log(`✓ ${CATEGORIES.length} categories`);
  await seedProducts();
  await seedDietaryQuestions();
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
