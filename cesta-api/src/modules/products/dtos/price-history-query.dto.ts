import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PriceHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'ID do supermercado; omitir retorna todos agrupados',
  })
  @IsOptional()
  @IsString()
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
