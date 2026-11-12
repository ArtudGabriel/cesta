import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductFiltersDto } from './dtos/product-filters.dto';
import { ProductResponseDto } from './dtos/product-response.dto';
import { SuggestResponseDto, SuggestionDto } from './dtos/suggest-query.dto';
import { ProductsRepository } from './products.repository';

@Injectable()
export class ProductsService {
  constructor(private readonly repo: ProductsRepository) {}

  async findMany(filters: ProductFiltersDto) {
    const { items, total } = await this.repo.findMany(filters);
    let mapped = items.map(ProductResponseDto.fromEntity);

    if ((filters.sortBy ?? 'cheapest') === 'cheapest') {
      mapped = mapped.sort((a, b) => {
        const ap = a.cheapestPrice ?? Number.POSITIVE_INFINITY;
        const bp = b.cheapestPrice ?? Number.POSITIVE_INFINITY;
        return ap - bp;
      });
    }

    return { items: mapped, total, page: filters.page, limit: filters.limit };
  }

  async findById(id: string): Promise<ProductResponseDto> {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundException(`Produto "${id}" não encontrado`);
    return ProductResponseDto.fromEntity(product);
  }

  async compare(ids: string[]): Promise<ProductResponseDto[]> {
    if (!ids.length) throw new BadRequestException('Informe ao menos 1 id');
    if (ids.length > 20) throw new BadRequestException('Máximo 20 produtos por comparação');
    const products = await this.repo.findManyByIds(ids);
    return products.map(ProductResponseDto.fromEntity);
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
