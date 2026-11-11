import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductFiltersDto } from './dtos/product-filters.dto';
import { ProductResponseDto } from './dtos/product-response.dto';
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
}
