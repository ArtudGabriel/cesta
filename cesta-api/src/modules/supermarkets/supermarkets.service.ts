import { Injectable, NotFoundException } from '@nestjs/common';
import { SupermarketResponseDto } from './dtos/supermarket-response.dto';
import { SupermarketsRepository } from './supermarkets.repository';

@Injectable()
export class SupermarketsService {
  constructor(private readonly repo: SupermarketsRepository) {}

  async findAll(): Promise<SupermarketResponseDto[]> {
    const items = await this.repo.findAll();
    return items.map(SupermarketResponseDto.fromEntity);
  }

  async findBySlug(slug: string): Promise<SupermarketResponseDto> {
    const sm = await this.repo.findBySlug(slug);
    if (!sm) throw new NotFoundException(`Supermarket "${slug}" não encontrado`);
    return SupermarketResponseDto.fromEntity(sm);
  }
}
