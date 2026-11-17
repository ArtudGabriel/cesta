import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app-exception';
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
    if (!sm)
      throw new AppException(
        'SUPERMARKETS.NOT_FOUND',
        `Supermarket "${slug}" não encontrado`,
        HttpStatus.NOT_FOUND,
        { slug },
      );
    return SupermarketResponseDto.fromEntity(sm);
  }
}
