import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app-exception';
import { ProductFiltersDto } from './dtos/product-filters.dto';
import { ProductResponseDto } from './dtos/product-response.dto';
import {
  ProductSearchQuery,
  ProductSearchResponseDto,
} from './dtos/product-search.dto';
import { SuggestResponseDto, SuggestionDto } from './dtos/suggest-query.dto';
import { ProductsRepository } from './products.repository';

const GRADE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

// Sprint 167 — oversample cap quando precisamos filtrar pós-fetch (nutriScore
// é computado no DTO). 20000 cobre o catálogo real prod (S142 audit: ~8580
// produtos) com 2.3x headroom pra crescimento. Se exceder, fail-fast via
// AppException — fallback silencioso banido (Reviewer AJUSTE S167): usuário
// recebe erro explícito que denormalização de grade virou prerequisite
// (schema change necessário), ao invés de total enganoso de volta.
const POST_FILTER_OVERSAMPLE = 20000;

@Injectable()
export class ProductsService {
  constructor(private readonly repo: ProductsRepository) {}

  async findMany(filters: ProductFiltersDto) {
    // Sprint 167 fix: nutriScore é computado no DTO (não é coluna indexada).
    // Antes: repo.findMany(skip/take) → filter in-memory sobre página atual →
    // total = mapped.length. Semantica quebrada: total refletia apenas a
    // página, não o universo filtrado global. User via "15 resultados" quando
    // total real podia ser 200 em páginas subsequentes.
    //
    // Novo contrato: nutriScore ativo → oversample todo match do WHERE
    // (até POST_FILTER_OVERSAMPLE), filtra em memória, sort em memória
    // (determinístico cross-page), aplica slice(skip, skip+limit) manual.
    // Total = universo pós-filtro. Pagination consistente entre páginas.
    if (filters.nutriScore) {
      return this.findManyWithPostFilter(filters);
    }

    const { items, total } = await this.repo.findMany(filters);
    const mapped = this.applySort(
      items.map(ProductResponseDto.fromEntity),
      filters.sortBy,
    );

    return {
      items: mapped,
      total,
      page: filters.page,
      limit: filters.limit,
    };
  }

  private async findManyWithPostFilter(filters: ProductFiltersDto) {
    const oversampleFilters: ProductFiltersDto = {
      ...filters,
      skip: 0,
      limit: POST_FILTER_OVERSAMPLE,
    };
    const { items, total: rawTotal } = await this.repo.findMany(
      oversampleFilters,
    );

    if (rawTotal > POST_FILTER_OVERSAMPLE) {
      // Fail-fast (Reviewer AJUSTE S167): nunca retorna total pós-filtro
      // undercounted. Schema change (denormalizar `nutri_score_grade` em
      // Product) é prerequisite antes de catalog crescer além do cap.
      throw new AppException(
        'PRODUCTS.NUTRI_FILTER_CAP_EXCEEDED',
        `nutriScore filter undercount risk: ${rawTotal} produtos excedem cap ${POST_FILTER_OVERSAMPLE}. Denormalizar grade antes de habilitar filtro em escala.`,
        HttpStatus.SERVICE_UNAVAILABLE,
        { rawTotal, cap: POST_FILTER_OVERSAMPLE },
      );
    }

    let mapped = items.map(ProductResponseDto.fromEntity);
    const threshold = GRADE_ORDER[filters.nutriScore!];
    mapped = mapped.filter((p) => {
      const grade = p.nutriScore?.grade;
      if (!grade) return false;
      return GRADE_ORDER[grade] <= threshold;
    });

    const filteredTotal = mapped.length;
    mapped = this.applySort(mapped, filters.sortBy);

    const skip = filters.skip ?? 0;
    const limit = filters.limit;
    const sliced = mapped.slice(skip, skip + limit);

    return {
      items: sliced,
      total: filteredTotal,
      page: filters.page,
      limit: filters.limit,
    };
  }

  private applySort(
    mapped: ProductResponseDto[],
    sortBy: ProductFiltersDto['sortBy'],
  ): ProductResponseDto[] {
    const effective = sortBy ?? 'cheapest';
    if (effective === 'cheapest') {
      return mapped.sort((a, b) => {
        const ap = a.cheapestPrice ?? Number.POSITIVE_INFINITY;
        const bp = b.cheapestPrice ?? Number.POSITIVE_INFINITY;
        return ap - bp;
      });
    }
    if (effective === 'nutriScore') {
      return mapped.sort((a, b) => {
        const ag = a.nutriScore?.grade;
        const bg = b.nutriScore?.grade;
        const av = ag ? GRADE_ORDER[ag] : Number.POSITIVE_INFINITY;
        const bv = bg ? GRADE_ORDER[bg] : Number.POSITIVE_INFINITY;
        return av - bv;
      });
    }
    return mapped;
  }

  async findById(id: string): Promise<ProductResponseDto> {
    const product = await this.repo.findById(id);
    if (!product) {
      throw new AppException(
        'PRODUCTS.NOT_FOUND',
        `Produto "${id}" não encontrado`,
        HttpStatus.NOT_FOUND,
      );
    }
    return ProductResponseDto.fromEntity(product);
  }

  /**
   * Sprint 132: top N produtos ranqueados por economia máxima disponível.
   * Sprint 155: threshold expandido. Antes: só produtos com ≥2 supermarkets
   * entravam (spread cross-market). Em prod, Mercadona domina catalog e a
   * section FeaturedDeals ficava vazia. Agora produto entra se:
   *  a) spread entre supers ≥ 0.01 €, OR
   *  b) qualquer supermercado tem previousPrice > currentPrice (promo real).
   *
   * Score = max(crossMarketSpread, bestSingleDiscount) em €. Ordem DESC.
   * Response shape inalterado (`ProductResponseDto[]`) — zero breaking
   * downstream.
   */
  async featuredDeals(limit: number): Promise<ProductResponseDto[]> {
    const products = await this.repo.findManyWithPrices();
    const scored = products
      .map((p) => {
        const mapped = ProductResponseDto.fromEntity(p);
        const available = mapped.prices.filter((pr) => pr.isAvailable);
        if (available.length === 0) return null;

        let crossMarketSavings = 0;
        if (available.length >= 2) {
          const priceVals = available.map((pr) => pr.price);
          crossMarketSavings =
            Math.max(...priceVals) - Math.min(...priceVals);
        }

        let bestSingleDiscount = 0;
        for (const pr of available) {
          if (pr.previousPrice != null && pr.previousPrice > pr.price) {
            const saving = pr.previousPrice - pr.price;
            if (saving > bestSingleDiscount) bestSingleDiscount = saving;
          }
        }

        const savings = Math.max(crossMarketSavings, bestSingleDiscount);
        if (savings <= 0) return null;
        return { product: mapped, savings };
      })
      .filter(
        (x): x is { product: ProductResponseDto; savings: number } =>
          x !== null,
      )
      .sort((a, b) => b.savings - a.savings)
      .slice(0, limit)
      .map((x) => x.product);
    return scored;
  }

  async compare(ids: string[]): Promise<ProductResponseDto[]> {
    if (!ids.length)
      throw new AppException(
        'PRODUCTS.COMPARE_EMPTY',
        'Informe ao menos 1 id',
        HttpStatus.BAD_REQUEST,
      );
    if (ids.length > 20)
      throw new AppException(
        'PRODUCTS.COMPARE_LIMIT_EXCEEDED',
        'Máximo 20 produtos por comparação',
        HttpStatus.BAD_REQUEST,
        { limit: 20, received: ids.length },
      );
    const products = await this.repo.findManyByIds(ids);
    return products.map(ProductResponseDto.fromEntity);
  }

  async search(query: ProductSearchQuery): Promise<ProductSearchResponseDto> {
    const { items, total } = await this.repo.findForSearch(
      query.q,
      query.limit,
    );
    return { items, total };
  }

  async suggest(q: string, limit: number): Promise<SuggestResponseDto> {
    const rows = await this.repo.findSuggestions(q.trim(), limit);
    const suggestions: SuggestionDto[] = rows.map((r) => {
      const cheapest = r.prices[0];
      return {
        id: r.id,
        name: r.name,
        brand: r.brand,
        imageUrl: r.imageUrl,
        cheapestPrice: cheapest
          ? {
              value: Number(cheapest.currentPrice),
              supermarketSlug: cheapest.supermarket.slug,
              supermarketName: cheapest.supermarket.name,
            }
          : null,
      };
    });
    return { suggestions };
  }
}
