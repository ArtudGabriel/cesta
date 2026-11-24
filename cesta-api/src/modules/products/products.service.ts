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

@Injectable()
export class ProductsService {
  constructor(private readonly repo: ProductsRepository) {}

  async findMany(filters: ProductFiltersDto) {
    const { items, total } = await this.repo.findMany(filters);
    let mapped = items.map(ProductResponseDto.fromEntity);

    // Sprint 147: filtro Nutri-Score pós-fetch (grade calculada no DTO).
    // Inclusivo: A → só A; B → A+B; C → A+B+C; etc. Produtos sem grade
    // (nutriScore=null) saem quando filtro aplicado.
    const GRADE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
    if (filters.nutriScore) {
      const threshold = GRADE_ORDER[filters.nutriScore];
      mapped = mapped.filter((p) => {
        const grade = p.nutriScore?.grade;
        if (!grade) return false;
        return GRADE_ORDER[grade] <= threshold;
      });
    }

    const sortBy = filters.sortBy ?? 'cheapest';
    if (sortBy === 'cheapest') {
      mapped = mapped.sort((a, b) => {
        const ap = a.cheapestPrice ?? Number.POSITIVE_INFINITY;
        const bp = b.cheapestPrice ?? Number.POSITIVE_INFINITY;
        return ap - bp;
      });
    } else if (sortBy === 'nutriScore') {
      mapped = mapped.sort((a, b) => {
        const ag = a.nutriScore?.grade;
        const bg = b.nutriScore?.grade;
        const av = ag ? GRADE_ORDER[ag] : Number.POSITIVE_INFINITY;
        const bv = bg ? GRADE_ORDER[bg] : Number.POSITIVE_INFINITY;
        return av - bv;
      });
    }

    return {
      items: mapped,
      total: filters.nutriScore ? mapped.length : total,
      page: filters.page,
      limit: filters.limit,
    };
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
   * Sprint 132: top N produtos com maior spread (maxPrice - minPrice) entre
   * supermarkets ativos disponíveis. Precisa >= 2 supermarkets disponíveis
   * pra entrar; spread em euros absolutos. Ordem DESC spread.
   */
  async featuredDeals(limit: number): Promise<ProductResponseDto[]> {
    const products = await this.repo.findManyWithPrices();
    const scored = products
      .map((p) => {
        const mapped = ProductResponseDto.fromEntity(p);
        const available = mapped.prices.filter((pr) => pr.isAvailable);
        if (available.length < 2) return null;
        const prices = available.map((pr) => pr.price);
        const spread = Math.max(...prices) - Math.min(...prices);
        return { product: mapped, spread };
      })
      .filter((x): x is { product: ProductResponseDto; spread: number } => x !== null)
      .sort((a, b) => b.spread - a.spread)
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
