// Sprint 142: resolve nome de produto (+ categoryHint opcional do adapter)
// em slug de Category seedada (`lacteos`, `pan-bolleria`, ...).
//
// Audit Neon 2026-11-24: 8553/8580 produtos (99.7%) com category_id NULL
// — adapters coletam categoryHint mas CatalogSyncService nunca persistia
// o resolvido. Backfill script + fix no create path endereçam.
//
// Heurística: lowercase + diacritics strip + check keyword list por slug
// na ordem (primeiro match vence). Keywords baseadas em observação de
// categoryHint real (Mercadona = "Lácteos, huevos", Froiz = "Carnicería",
// etc) + termos frequentes no `name` dos produtos.

export type CategorySlug =
  | 'lacteos'
  | 'pan-bolleria'
  | 'carne'
  | 'pescado'
  | 'frutas-verduras'
  | 'bebidas'
  | 'despensa'
  | 'congelados'
  | 'limpieza'
  | 'higiene'
  | 'bebes'
  | 'mascotas'
  | 'snacks-dulces'
  | 'desayuno-cereales'
  | 'salsas-conservas';

interface Rule {
  slug: CategorySlug;
  /** Tokens que, se encontrados como substring, classificam. */
  keywords: string[];
}

// Ordem importa: regras mais específicas antes das gerais (e.g. "aceite
// de oliva" cai em despensa, não em bebidas/liquid).
const RULES: Rule[] = [
  {
    slug: 'bebes',
    keywords: [
      'pañal',
      'panal',
      'bebe',
      'bebes',
      'bebé',
      'bebés',
      'infantil',
      'papilla',
      'tiritas bebe',
    ],
  },
  {
    slug: 'mascotas',
    keywords: [
      'perro',
      'gato',
      'mascot',
      'pienso perro',
      'pienso gato',
      'arena gato',
      'snacks mascota',
    ],
  },
  {
    slug: 'congelados',
    keywords: [
      'congelad',
      'pescado congelado',
      'verdura congelada',
      'pizza congelada',
      'helado',
      'helados',
      'surimi',
      'calamar congelado',
      'bacalao congelado',
      'merluza congelada',
    ],
  },
  {
    slug: 'snacks-dulces',
    keywords: [
      'patata frita',
      'patatas fritas',
      'chips',
      'snacks',
      'palomitas',
      'frutos secos',
      'almendra',
      'nuez',
      'nueces',
      'avellana',
      'cacahuete',
      'pistacho',
      'chocolate',
      'bombón',
      'bombon',
      'caramelo',
      'chicle',
      'golosina',
      'turrón',
      'turron',
      'polvorón',
      'polvoron',
      'mantecado',
    ],
  },
  {
    slug: 'lacteos',
    keywords: [
      'leche',
      'yogur',
      'yogurt',
      'queso',
      'quesos',
      'nata',
      'mantequilla',
      'margarina',
      'cuajada',
      'kefir',
      'huevo',
      'huevos',
      'lacteo',
      'lácteo',
      'lactea',
      'batido lacteo',
      'postres lacteos',
    ],
  },
  {
    slug: 'pan-bolleria',
    keywords: [
      'panecillo',
      'baguette',
      'bollo',
      'bollería',
      'bolleria',
      'bizcocho',
      'croissant',
      'cruasán',
      'cruasan',
      'magdalena',
      'donut',
      'donuts',
      'muffin',
      'rosquilla',
      'pan integral',
      'pan tostado',
      'pan rallado',
      'pan de molde',
      'barra de pan',
      'tortita',
      'galleta',
      'galletas',
    ],
  },
  {
    slug: 'desayuno-cereales',
    keywords: [
      'cereal',
      'cereales',
      'muesli',
      'granola',
      'copos de avena',
      'avena',
      'cacao soluble',
      'colacao',
      'nesquik',
      'nescafé',
      'nescafe',
      'café',
      'cafe soluble',
      'cafe molido',
      'infusión',
      'infusion',
      'infusao',
      'manzanilla',
      'mermelada',
      'confitura',
      'miel',
    ],
  },
  {
    slug: 'carne',
    keywords: [
      'pollo',
      'ternera',
      'vaca',
      'cerdo',
      'cordero',
      'conejo',
      'chuletón',
      'chuleton',
      'chuleta',
      'solomillo',
      'entrecot',
      'carne picada',
      'hamburguesa',
      'embutido',
      'jamón',
      'jamon',
      'chorizo',
      'salchichón',
      'salchichon',
      'bacón',
      'bacon',
      'panceta',
      'lomo embuchado',
      'mortadela',
      'pavo',
      'carniceri',
      'casqueri',
    ],
  },
  {
    slug: 'pescado',
    keywords: [
      'merluza',
      'salmón',
      'salmon',
      'atún',
      'atun',
      'bacalao',
      'sardina',
      'anchoa',
      'boquerón',
      'boqueron',
      'gambas',
      'gamba',
      'langostino',
      'camarón',
      'camaron',
      'calamar',
      'pulpo',
      'mejillón',
      'mejillon',
      'almeja',
      'rape',
      'lubina',
      'dorada',
      'pescaderi',
      'pescado',
    ],
  },
  {
    slug: 'frutas-verduras',
    keywords: [
      'manzana',
      'naranja',
      'plátano',
      'platano',
      'pera',
      'piña',
      'pina',
      'fresa',
      'uva',
      'kiwi',
      'limón',
      'limon',
      'mango',
      'sandía',
      'sandia',
      'melón',
      'melon',
      'arándan',
      'arandano',
      'frambuesa',
      'tomate',
      'patata',
      'cebolla',
      'ajo',
      'pimiento',
      'zanahoria',
      'calabacín',
      'calabacin',
      'lechuga',
      'espinaca',
      'brócoli',
      'brocoli',
      'coliflor',
      'pepino',
      'judía verde',
      'judia verde',
      'aguacate',
      'champiñón',
      'champinon',
      'setas',
      'fruta',
      'verdura',
      'fresco',
    ],
  },
  {
    slug: 'bebidas',
    keywords: [
      'agua mineral',
      'agua ',
      'refresco',
      'cola',
      'coca',
      'pepsi',
      'fanta',
      'nestea',
      'aquarius',
      'sprite',
      'zumo',
      'jugo',
      'nectar',
      'cerveza',
      'vino',
      'tinto',
      'blanco',
      'rosado',
      'licor',
      'whisky',
      'ron',
      'ginebra',
      'vodka',
      'cava',
      'champagne',
      'sidra',
    ],
  },
  {
    slug: 'salsas-conservas',
    keywords: [
      'tomate frito',
      'ketchup',
      'mayonesa',
      'mostaza',
      'salsa',
      'vinagre',
      'aceituna',
      'alcaparra',
      'conserva',
      'atún en lata',
      'atun en lata',
      'sardinas en lata',
      'maíz',
      'maiz',
      'pepinillo',
    ],
  },
  {
    slug: 'despensa',
    keywords: [
      'arroz',
      'pasta',
      'macarrón',
      'macarron',
      'espagueti',
      'fideos',
      'legumbre',
      'lenteja',
      'garbanzo',
      'alubia',
      'judía seca',
      'judia seca',
      'aceite',
      'oliva virgen',
      'girasol',
      'harina',
      'levadura',
      'azúcar',
      'azucar',
      'sal',
      'especia',
      'orégano',
      'oregano',
      'pimentón',
      'pimenton',
      'caldo',
      'pastilla caldo',
    ],
  },
  {
    slug: 'limpieza',
    keywords: [
      'detergente',
      'lavavajilla',
      'suavizante',
      'lejía',
      'lejia',
      'limpiador',
      'fregasuelos',
      'estropajo',
      'bayeta',
      'papel higiénico',
      'papel higienico',
      'rollo papel',
      'servilleta',
      'bolsa basura',
      'friegasuelos',
    ],
  },
  {
    slug: 'higiene',
    keywords: [
      'champú',
      'champu',
      'acondicionador',
      'gel de ducha',
      'desodorante',
      'crema facial',
      'crema hidratante',
      'dentífrico',
      'dentifrico',
      'pasta de dientes',
      'cepillo dientes',
      'maquinilla afeitar',
      'colonia',
      'perfume',
      'compresa',
      'tampón',
      'tampon',
      'protege slip',
      'toallita',
    ],
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const WORD_BOUNDARY = /[^a-z0-9]/;

/**
 * Prefix-boundary match: keyword precedido por boundary (início ou
 * non-alphanum). Sufixo livre — cobre plurais ("panal" ⊂ "panales"),
 * flexões ("carniceri" ⊂ "carniceria"). Evita "te" matchar "entero"
 * (char antes = "n", alphanum → fail).
 */
function matchKeyword(haystack: string, needle: string): boolean {
  let searchFrom = 0;
  while (searchFrom <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, searchFrom);
    if (idx < 0) return false;
    const before = idx === 0 ? ' ' : haystack[idx - 1];
    if (WORD_BOUNDARY.test(before)) return true;
    searchFrom = idx + 1;
  }
  return false;
}

/**
 * Determina slug de categoria baseado em nome + hint (hint tem
 * prioridade quando contém match direto de slug). Retorna null se
 * nenhuma regra bate — caller mantém `categoryId=null`.
 */
export function resolveCategorySlug(
  productName: string,
  hint?: string | null,
): CategorySlug | null {
  const haystack = normalize(`${hint ?? ''} ${productName}`);
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      const needle = normalize(kw).trim();
      if (needle.length === 0) continue;
      if (matchKeyword(haystack, needle)) return rule.slug;
    }
  }
  return null;
}


/** Exposto para spec + script. */
export const CATEGORY_RULES = RULES;
