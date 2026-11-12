import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.validator';

export class PriceHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'ID do supermercado; omitir retorna todos agrupados',
  })
  @IsOptional()
  @IsCuid()
  supermarketId?: string;

  @ApiPropertyOptional({
    description: 'Janela em dias (1..90)',
    default: 30,
    minimum: 1,
    maximum: 90,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days: number = 30;
}
