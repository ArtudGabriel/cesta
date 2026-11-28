import { Injectable } from '@nestjs/common';
import {
  Category,
  Prisma,
  Product,
  ProductPrice,
  Supermarket,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ProductFiltersDto } from './dtos/product-filters.dto';
import { scorePhraseMatch } from './match-score.util';

export type ProductWithPrices = Product & {
  prices: (ProductPrice & { supermarket: Supermarket })[];
  category: Category | null;
  // Sprint 244 (ADR 0044): duplicates do grupo canônico (opcional ·
  // populado via CANONICAL_INCLUDE em read path endpoints).
  duplicates?: (Product & {
    prices: (ProductPrice & { supermarket: Supermarket })[];
  })[];
};

const PRICE_WHERE = {
  supermarket: { isActive: true },
  deletedAt: null,
} as const;

const PRICE_INCLUDE = {
  prices: {
    include: { supermarket: true },
    // Sprint 234 G3 recall fix (ADR 0041): filtra soft-deleted seed prices.
    where: PRICE_WHERE,
  },
  // Sprint 61: category.slug alimenta o mapping de variante Nutri-Score em
  // `ProductResponseDto.fromEntity`.
  category: true,
} as const;

// Sprint 244 (ADR 0044): include canonical group — PRICE_INCLUDE + duplicates
// (non-deleted) com suas prices. Usado em read path endpoints que precisam
// agregar preços cross-mercado dentro do cluster.
const CANONICAL_INCLUDE = {
  ...PRICE_INCLUDE,
  duplicates: {
    where: { deletedAt: null },
    include: {
      prices: {
        include: { supermarket: true },
        where: PRICE_WHERE,
      },
    },
  },
} as const;

/**
 * Sprint 228 #7: tokeniza query multi-palavra e exige AND de ILIKE em
 * name/brand por token. Query "coca zero" com single `contains` ILIKE
 * '%coca zero%' NÃO achava "Coca-Cola Zero Azucar 2L" porque não existe
 * substring literal "coca zero" (hyphen + "Cola " entre). Tokenize
 * resolve o caso comum multi-palavra sem depender de pg_trgm fuzzy
 * fallback (que é pra typo, não pra ordem/separadores).
 *
 * - 0 tokens: guard match-nothing (query vazia não deve chegar aqui).
 * - 1 token: preserva comportamento legado (single OR name/brand).
 * - 2+ tokens: AND-of-OR — cada token deve aparecer em name OU brand.
 */
function buildMultiTokenNameBrandWhere(q: string): Prisma.ProductWhereInput {
  const tokens = q.trim().split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return { id: '__none__' };
  }
  if (tokens.length === 1) {
    return {
      OR: [
        { name: { contains: tokens[0], mode: 'insensitive' } },
        { brand: { contains: tokens[0], mode: 'insensitive' } },
      ],
    };
  }
  return {
    AND: tokens.map((t) => ({
      OR: [
        { name: { contains: t, mode: 'insensitive' } },
        { brand: { contains: t, mode: 'insensitive' } },
      ],
    })),
  };
}

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    filters: ProductFiltersDto,
  ): Promise<{ items: ProductWithPrices[]; total: number }> {
    const where = await this.buildWhere(filters);
    const orderBy = this.buildOrderBy(filters.sortBy);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: CANONICAL_INCLUDE,
        orderBy,
        skip: filters.skip,
        take: filters.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Sprint 244 (ADR 0044): se `id` é child (canonicalProductId != null),
   * resolve ao canonical. Retorna o canonical com `duplicates[]` loaded
   * pra agregação no DTO. Null quando id não existe ou canonical foi
   * soft-deleted.
   */
  async findById(id: string): Promise<ProductWithPrices | null> {
    const self = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, canonicalProductId: true },
    });
    if (!self) return null;
    const canonicalId = self.canonicalProductId ?? self.id;
    return this.prisma.product.findFirst({
      where: { id: canonicalId, deletedAt: null },
      include: CANONICAL_INCLUDE,
    });
  }

  /**
   * Sprint 244 (ADR 0044): resolve cada id ao canonical do grupo, dedupe,
   * e carrega todos os canonicals com duplicates agregados. Usado por
   * /products/compare — 2 ids no mesmo cluster viram 1 row.
   */
  async findManyByIds(ids: string[]): Promise<ProductWithPrices[]> {
    if (ids.length === 0) return [];
    const resolved = await this.prisma.product.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, canonicalProductId: true },
    });
    const canonicalIds = Array.from(
      new Set(resolved.map((r) => r.canonicalProductId ?? r.id)),
    );
    if (canonicalIds.length === 0) return [];
    return this.prisma.product.findMany({
      where: { id: { in: canonicalIds }, deletedAt: null },
      include: CANONICAL_INCLUDE,
    });
  }

  /**
   * Sprint 132: produtos com 2+ preços disponíveis (candidatos a featured
   * deal). Cap no fetch pra evitar carregar catálogo inteiro — service
   * depois calcula spread + top N. Oversample 10x limit alvo (service pede
   * limit pequeno, 10-50).
   *
   * Sprint 156: agora retorna UNIÃO de duas sub-queries filtradas no DB:
   *  a) todos os produtos com `previousPrice != null` (promos atuais ou
   *     recentes — não limitado por `updatedAt` pq produtos de promo
   *     costumam ter `updatedAt` antigo quando o sync não os re-toca);
   *  b) top-updated com 2+ supers (preserva comportamento S132 cross-market).
   * Dedupe por `id`. Service decide por scoring. QA S155 detectou que
   * cap 500 + orderBy updatedAt mandava produtos de promo pra fora da
   * janela, section FeaturedDeals ficava vazia.
   */
  async findManyWithPrices(cap = 500): Promise<ProductWithPrices[]> {
    // Sprint 244 (ADR 0044): filtra canonical (canonicalProductId IS NULL);
    // duplicates do grupo entram via include pra agregação de prices.
    const [withPromo, recent] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          deletedAt: null,
          canonicalProductId: null,
          prices: {
            some: {
              isAvailable: true,
              previousPrice: { not: null },
              deletedAt: null,
            },
          },
        },
        include: CANONICAL_INCLUDE,
        take: cap,
      }),
      this.prisma.product.findMany({
        where: {
          deletedAt: null,
          canonicalProductId: null,
          prices: { some: { isAvailable: true, deletedAt: null } },
        },
        include: CANONICAL_INCLUDE,
        take: cap,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    const byId = new Map<string, ProductWithPrices>();
    for (const row of withPromo) byId.set(row.id, row);
    for (const row of recent) if (!byId.has(row.id)) byId.set(row.id, row);
    return [...byId.values()];
  }

  async findForSearch(q: string, limit: number): Promise<{
    items: Array<{
      id: string;
      name: string;
      imageUrl: string | null;
      cheapestUnitPrice: number | null;
    }>;
    total: number;
  }> {
    // Sprint 106 (fix S106) — ILIKE em name/brand. Prisma não suporta orderBy
    // em agregado de relação 1:N (menor price per product) sem raw SQL. Pra
    // garantir "top N globais por cheapestUnitPrice", oversample (limit*3,
    // cap 40) e re-ordena+slica em memória (mesmo padrão de findSuggestions
    // L133). `take: limit` puro ordenava só rows arbitrárias do DB.
    //
    // Sprint 243b: exige >=1 price ativo (isAvailable=true, deletedAt=null).
    // Produtos seed limpos (189 rows soft-del em 2026-11-27 23:02:43Z UTC)
    // sem catálogo real saem da busca.
    // Sprint 244 (ADR 0044): dedupe canonical — WHERE canonicalProductId IS
    // NULL. Price agregado inclui duplicates' prices pra cheapestUnitPrice
    // refletir o grupo inteiro (price pode vir de um child doutro mercado).
    // AND wrapping: name/brand OR + price-existence OR não podem colidir na
    // mesma key `OR`. Prisma trata AND[] como interseção (via `where.AND`).
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      canonicalProductId: null,
      AND: [
        // Sprint 228 #7: multi-token tokenize AND-of-OR (vide helper).
        buildMultiTokenNameBrandWhere(q),
        {
          OR: [
            { prices: { some: { isAvailable: true, deletedAt: null } } },
            {
              duplicates: {
                some: {
                  deletedAt: null,
                  prices: { some: { isAvailable: true, deletedAt: null } },
                },
              },
            },
          ],
        },
      ],
    };

    const sampleSize = Math.min(limit * 3, 40);

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        take: sampleSize,
        select: {
          id: true,
          name: true,
          imageUrl: true,
          prices: {
            where: {
              isAvailable: true,
              supermarket: { isActive: true },
              deletedAt: null,
            },
            orderBy: { currentPrice: 'asc' },
            take: 1,
            select: { currentPrice: true },
          },
          duplicates: {
            where: { deletedAt: null },
            select: {
              prices: {
                where: {
                  isAvailable: true,
                  supermarket: { isActive: true },
                  deletedAt: null,
                },
                orderBy: { currentPrice: 'asc' },
                take: 1,
                select: { currentPrice: true },
              },
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const scored = rows.map((r) => {
      const selfMin = r.prices[0] ? Number(r.prices[0].currentPrice) : null;
      let groupMin = selfMin;
      for (const d of r.duplicates ?? []) {
        const dp = d.prices[0] ? Number(d.prices[0].currentPrice) : null;
        if (dp != null && (groupMin == null || dp < groupMin)) groupMin = dp;
      }
      return {
        id: r.id,
        name: r.name,
        imageUrl: r.imageUrl,
        cheapestUnitPrice: groupMin,
      };
    });

    scored.sort((a, b) => {
      const ap = a.cheapestUnitPrice ?? Number.POSITIVE_INFINITY;
      const bp = b.cheapestUnitPrice ?? Number.POSITIVE_INFINITY;
      return ap - bp;
    });

    return { items: scored.slice(0, limit), total };
  }

  async findSuggestions(q: string, limit: number): Promise<
    Array<{
      id: string;
      name: string;
      brand: string | null;
      imageUrl: string | null;
      prices: { currentPrice: Prisma.Decimal; supermarket: Supermarket }[];
    }>
  > {
    // startsWith prefere, depois contains. Prisma nao tem relevance score;
    // buscamos (limit*2) e priorizamos startsWith no sort em memoria.
    // Sprint 243b: exige >=1 price ativo (isAvailable=true, deletedAt=null).
    // Sprint 244 (ADR 0044): canonical-only + union com duplicates' prices
    // pro cheapest refletir grupo cross-mercado.
    const take = Math.min(limit * 2, 40);
    const rows = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        canonicalProductId: null,
        AND: [
          // Sprint 228 #7: multi-token tokenize AND-of-OR (vide helper).
          buildMultiTokenNameBrandWhere(q),
          {
            OR: [
              { prices: { some: { isAvailable: true, deletedAt: null } } },
              {
                duplicates: {
                  some: {
                    deletedAt: null,
                    prices: { some: { isAvailable: true, deletedAt: null } },
                  },
                },
              },
            ],
          },
        ],
      },
      take,
      select: {
        id: true,
        name: true,
        brand: true,
        imageUrl: true,
        prices: {
          where: {
            isAvailable: true,
            supermarket: { isActive: true },
            deletedAt: null,
          },
          orderBy: { currentPrice: 'asc' },
          take: 1,
          select: {
            currentPrice: true,
            supermarket: true,
          },
        },
        duplicates: {
          where: { deletedAt: null },
          select: {
            prices: {
              where: {
                isAvailable: true,
                supermarket: { isActive: true },
                deletedAt: null,
              },
              orderBy: { currentPrice: 'asc' },
              take: 1,
              select: {
                currentPrice: true,
                supermarket: true,
              },
            },
          },
        },
      },
    });

    // Sprint 244 (ADR 0044): merge duplicates' cheapest price na view
    // de suggestion. Se grupo tem price mais barato em um child doutro
    // mercado, suggestion exibe esse (evitar mostrar preço canonical
    // enquanto cross-mercado tem oferta melhor).
    const rowsWithGroupCheapest = rows.map((r) => {
      let best: { currentPrice: Prisma.Decimal; supermarket: Supermarket } | null =
        r.prices[0] ?? null;
      for (const d of r.duplicates ?? []) {
        const dp = d.prices[0];
        if (!dp) continue;
        if (!best || Number(dp.currentPrice) < Number(best.currentPrice)) {
          best = dp;
        }
      }
      return {
        id: r.id,
        name: r.name,
        brand: r.brand,
        imageUrl: r.imageUrl,
        prices: best ? [best] : [],
      };
    });

    // Sprint 180 fuzzy fallback: ILIKE zero matches → tenta pg_trgm similarity.
    // GIN index idx_product_name_trgm + idx_product_brand_trgm aceleram operador %.
    // Threshold 0.3 Postgres default; tolera ~1-2 typos em palavra 5-6 chars.
    if (rows.length === 0 && q.trim().length >= 3) {
      // Sprint 181 fix: similarity() compara trigrams da string inteira.
      // Nome real ("Leche entera 1L" 15 chars) vs query ("lecge" 5 chars) →
      // overhead chars extras derruba score pra 0.158 (abaixo threshold 0.3).
      // Baseline Neon prod diagnose:
      //   similarity('lecge','leche')              = 0.33
      //   similarity('lecge','Leche entera 1L')    = 0.158 ← FALHA
      //   word_similarity('lecge','Leche entera 1L') = 0.5 ← OK
      // word_similarity(query, text) compara trigrams da query vs melhor
      // substring do text, ignora resto. GIN gin_trgm_ops acelera ambos.
      // Prisma @@map: Product → "products"; @map("deleted_at") → "deleted_at"
      // (name/brand sem @map ficam camelCase default).
      // Sprint 182 rerank boost: word_similarity ranqueia por word-match density;
      // produto longo com target em contexto ganha vs produto curto standalone.
      // Ex S181 nit P3: q='lecge' → 'Surtido bombones chocolate con leche Navidad'
      // antes de 'Leche entera brik 1L'. User espera direct match top.
      //
      // Boost rules:
      //  a) +0.3 quando LOWER("name") começa com LOWER(q) (prefix exact; cobre
      //     baseline "leche"→"Leche entera" sem typo).
      //  b) +0.3 quando primeira palavra do name fuzzy-match query via
      //     word_similarity(q, SPLIT_PART("name",' ',1)) > 0.5 (cobre typo
      //     cases como "lecge"→name="Leche entera brik 1L" first_word="Leche"
      //     word_sim=0.5+).
      //  c) Sprint 185 (nit S182 P3): +0.3 quando LEFT(first_word,3) = LEFT(q,3)
      //     E |len(first_word)-len(q)| <= 1 (short direct-typo signal). Cobre
      //     "lecge"→"Leche" (3-prefix='lec'=='lec', len diff 0) sem favorecer
      //     "Lechuga" (len diff 7-5=2). Independente de boost (b) — pega casos
      //     onde word_similarity do first_word < 0.5 mas prefix curto + comprimento
      //     indicam typo direto.
      // Boost cumulativo todos triggers; threshold WHERE 0.3 raw preservado.
      //
      // Sprint 187 (nit S185 P3): soma dos 3 boosts envolvida em LEAST(..., 1.0)
      // como ceiling defensivo. Hoje max teórico = 0.3*3 = 0.9 (<1.0, no-op),
      // mas se boost rules crescerem (b4, b5...) o cap previne score inflation
      // que possa drownar o sinal word_similarity base. Não aplica cap no score
      // total (base + boosts) pra preservar o range original word_similarity.
      //
      // Sprint 185 tiebreak determinístico: scores empatados → nome mais curto
      // primeiro, depois alfabético. Garante ordenação estável independente do
      // plano de execução Postgres (seen in prod: Lechuga top1 Leche #2 com
      // scores próximos).
      // Sprint 243b: trigram fallback também exige >=1 price ativo.
      // EXISTS correlated subquery (product_prices.product_id = products.id
      // AND is_available = true AND deleted_at IS NULL).
      // Sprint 244 (ADR 0044): trigram fallback também filtra canonical-only
      // (canonical_product_id IS NULL) + aceita price em qualquer membro do
      // grupo (canonical OR duplicate).
      const trgmIds = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "products"
        WHERE "deleted_at" IS NULL
          AND "canonical_product_id" IS NULL
          AND (
            EXISTS (
              SELECT 1 FROM "product_prices" pp
              WHERE pp."product_id" = "products"."id"
                AND pp."is_available" = true
                AND pp."deleted_at" IS NULL
            )
            OR EXISTS (
              SELECT 1 FROM "products" d
              JOIN "product_prices" pp ON pp."product_id" = d."id"
              WHERE d."canonical_product_id" = "products"."id"
                AND d."deleted_at" IS NULL
                AND pp."is_available" = true
                AND pp."deleted_at" IS NULL
            )
          )
          AND (
            word_similarity(${q}, "name") > 0.3
            OR ("brand" IS NOT NULL AND word_similarity(${q}, "brand") > 0.3)
          )
        ORDER BY (
          GREATEST(
            word_similarity(${q}, "name"),
            COALESCE(word_similarity(${q}, "brand"), 0)
          )
          + LEAST(
              CASE
                WHEN LOWER("name") LIKE LOWER(${q}) || '%'
                  OR LOWER("name") ~ ('(^|\s)' || LOWER(${q}))
                THEN 0.3
                ELSE 0
              END
              + CASE
                  WHEN word_similarity(${q}, SPLIT_PART("name", ' ', 1)) >= 0.5
                  THEN 0.3
                  ELSE 0
                END
              + CASE
                  WHEN LEFT(LOWER(SPLIT_PART("name", ' ', 1)), 3) = LEFT(LOWER(${q}), 3)
                    AND ABS(char_length(SPLIT_PART("name", ' ', 1)) - char_length(${q})) <= 1
                  THEN 0.3
                  ELSE 0
                END
            , 1.0)
        ) DESC,
        char_length("name") ASC,
        "name" ASC
        LIMIT ${take}
      `;
      if (trgmIds.length > 0) {
        const trgmRows = await this.prisma.product.findMany({
          where: { id: { in: trgmIds.map((r) => r.id) }, deletedAt: null },
          select: {
            id: true,
            name: true,
            brand: true,
            imageUrl: true,
            prices: {
              where: {
                isAvailable: true,
                supermarket: { isActive: true },
                deletedAt: null,
              },
              orderBy: { currentPrice: 'asc' },
              take: 1,
              select: {
                currentPrice: true,
                supermarket: true,
              },
            },
            // Sprint 244 (ADR 0044): include duplicates cheapest no trgm path.
            duplicates: {
              where: { deletedAt: null },
              select: {
                prices: {
                  where: {
                    isAvailable: true,
                    supermarket: { isActive: true },
                    deletedAt: null,
                  },
                  orderBy: { currentPrice: 'asc' },
                  take: 1,
                  select: {
                    currentPrice: true,
                    supermarket: true,
                  },
                },
              },
            },
          },
        });
        // Preserva ordem similaridade DESC retornada pelo raw query
        const byId = new Map(trgmRows.map((r) => [r.id, r]));
        return trgmIds
          .map((t) => byId.get(t.id))
          .filter((r): r is NonNullable<typeof r> => r !== undefined)
          .map((r) => {
            let best:
              | { currentPrice: Prisma.Decimal; supermarket: Supermarket }
              | null = r.prices[0] ?? null;
            for (const d of r.duplicates ?? []) {
              const dp = d.prices[0];
              if (!dp) continue;
              if (
                !best ||
                Number(dp.currentPrice) < Number(best.currentPrice)
              ) {
                best = dp;
              }
            }
            return {
              id: r.id,
              name: r.name,
              brand: r.brand,
              imageUrl: r.imageUrl,
              prices: best ? [best] : [],
            };
          })
          .slice(0, limit);
      }
    }

    // Sprint 237: scoring por phrase tiers (name start → name middle → brand
    // start → brand middle → tokens-only AND match). Tiebreak secundário por
    // cheapestPrice ASC (preserva comportamento anterior pra empates dentro
    // do mesmo tier). Reintroduz determinismo que Fuse.js re-rank no front
    // (useFuzzySuggestions) estava borrando pra buscas de frase exata.
    // Sprint 244 (ADR 0044): usa rowsWithGroupCheapest — prices[0] já é o
    // menor preço do grupo canônico (canonical + duplicates).
    const scored = rowsWithGroupCheapest.map((r) => {
      const cheapest = r.prices[0]
        ? Number(r.prices[0].currentPrice)
        : Number.POSITIVE_INFINITY;
      const score = scorePhraseMatch({
        name: r.name,
        brand: r.brand,
        query: q,
      });
      return { row: r, score: score.combined, cheapest };
    });
    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.cheapest - b.cheapest;
    });
    return scored.slice(0, limit).map((s) => s.row);
  }

  private async buildWhere(filters: ProductFiltersDto): Promise<Prisma.ProductWhereInput> {
    // Sprint 244 (ADR 0044): listagens canonical-only (canonicalProductId
    // IS NULL); duplicates entram via CANONICAL_INCLUDE pra agregação.
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      canonicalProductId: null,
    };
    const andClauses: Prisma.ProductWhereInput[] = [];

    if (filters.search) {
      // Sprint 228 #7: multi-token search com normalizedName fallback.
      // Mesmo pattern do helper mas inclui normalizedName no OR (campo
      // lowercased pré-stemmer do catalog-sync). normalizedName não
      // precisa `mode: 'insensitive'` porque já é lowercase.
      // Sprint 244 (ADR 0044): tokens vão em AND[] pra não colidir com o
      // price-union OR adicionado abaixo.
      const tokens = filters.search
        .trim()
        .split(/\s+/)
        .filter((t) => t.length > 0);
      if (tokens.length === 1) {
        andClauses.push({
          OR: [
            { name: { contains: tokens[0], mode: 'insensitive' } },
            { brand: { contains: tokens[0], mode: 'insensitive' } },
            { normalizedName: { contains: tokens[0].toLowerCase() } },
          ],
        });
      } else if (tokens.length >= 2) {
        for (const t of tokens) {
          const tokenClause: Prisma.ProductWhereInput = {
            OR: [
              { name: { contains: t, mode: 'insensitive' } },
              { brand: { contains: t, mode: 'insensitive' } },
              { normalizedName: { contains: t.toLowerCase() } },
            ],
          };
          andClauses.push(tokenClause);
        }
      }
    }

    if (filters.brand) {
      where.brand = { equals: filters.brand, mode: 'insensitive' };
    }

    if (filters.category) {
      const category = await this.prisma.category.findFirst({
        where: {
          OR: [{ id: filters.category }, { slug: filters.category }],
        },
        select: { id: true },
      });
      if (category) where.categoryId = category.id;
      else where.categoryId = '__none__'; // força zero resultado
    }

    // Sprint 243b (URGENTE): endpoints públicos listagem/busca/suggest
    // excluem produto sem price ativo (isAvailable=true AND deletedAt=null).
    // Trigger imediato: Boss rodou cleanup-seed-prices --apply em prod
    // (2026-11-27 23:02:43Z UTC · PITR) soft-deletando 189 preços seed
    // (27 prods × 7 mercados). Produtos seed remanescentes apareciam com
    // prices=[] em GET /products?search + /products/search. Detalhe
    // (/products/:id) preserva comportamento (debug/admin).
    const priceFilters: Prisma.ProductPriceWhereInput = {
      isAvailable: true,
      deletedAt: null,
    };
    // Sprint 147: supermarkets[] (multi) tem precedência sobre supermarket single.
    if (filters.supermarkets && filters.supermarkets.length > 0) {
      priceFilters.supermarket = { slug: { in: filters.supermarkets } };
    } else if (filters.supermarket) {
      priceFilters.supermarket = { slug: filters.supermarket };
    }
    if (filters.onPromotion) priceFilters.onPromotion = true;
    // Preço range (inclusivo) sobre `currentPrice`.
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const priceRange: Prisma.DecimalFilter = {};
      if (filters.minPrice !== undefined) {
        priceRange.gte = new Prisma.Decimal(filters.minPrice);
      }
      if (filters.maxPrice !== undefined) {
        priceRange.lte = new Prisma.Decimal(filters.maxPrice);
      }
      priceFilters.currentPrice = priceRange;
    }
    // Sempre exige >=1 price que satisfaça o filtro (default isAvailable=true
    // + deletedAt=null). Filtros adicionais do caller apertam, nunca relaxam.
    // Sprint 244 (ADR 0044): aceita price também vindo de duplicate do grupo
    // canônico (cross-mercado via cluster S232).
    andClauses.push({
      OR: [
        { prices: { some: priceFilters } },
        {
          duplicates: {
            some: {
              deletedAt: null,
              prices: { some: priceFilters },
            },
          },
        },
      ],
    });

    if (andClauses.length > 0) where.AND = andClauses;

    if (filters.isVegan) where.isVegan = true;
    if (filters.isVegetarian) where.isVegetarian = true;
    if (filters.isGlutenFree) where.isGlutenFree = true;
    if (filters.isLactoseFree) where.isLactoseFree = true;

    return where;
  }

  private buildOrderBy(
    sortBy: ProductFiltersDto['sortBy'] = 'cheapest',
  ): Prisma.ProductOrderByWithRelationInput {
    switch (sortBy) {
      case 'newest':
        return { createdAt: 'desc' };
      case 'name':
        return { name: 'asc' };
      case 'cheapest':
      default:
        // Ordena por nome; sort real por preço feito no service (pricePerUnit calculado)
        return { name: 'asc' };
    }
  }
}
