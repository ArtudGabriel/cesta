import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dtos/pagination.dto';

function toBool({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
}

// Permissivo: letras unicode + dígitos + espaço + pontuação varejo (hífen, apóstrofo, parênteses, ponto, vírgula, %, &).
export const SEARCH_PATTERN = /^[\p{L}\p{N}\s\-'().,%&]*$/u;
// Slug ou CUID: a-z0-9- (CUIDs são lowercase alnum, slugs idem com hífen).
const SLUG_OR_CUID_PATTERN = /^[a-z0-9-]{1,64}$/;

/**
 * Sprint 147: `?supermarkets=mercadona,dia` ou `?supermarkets=mercadona` .
 * Normaliza pra `string[]` validado via `SLUG_OR_CUID_PATTERN`.
 */
function toSlugArray({ value }: { value: unknown }): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const out: string[] = [];
  for (const item of raw) {
    const trimmed = String(item).trim();
    if (trimmed.length === 0) continue;
    if (!SLUG_OR_CUID_PATTERN.test(trimmed)) return undefined;
    out.push(trimmed);
  }
  return out.length > 0 ? out : undefined;
}

export class ProductFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca por nome ou marca', maxLength: 128 })
  @IsOptional()
  @IsString()
  @Length(0, 128)
  @Matches(SEARCH_PATTERN, { message: 'search contains invalid characters' })
  search?: string;

  @ApiPropertyOptional({ description: 'Slug ou id da categoria' })
  @IsOptional()
  @IsString()
  @Matches(SLUG_OR_CUID_PATTERN, { message: 'category must be a slug or cuid' })
  category?: string;

  @ApiPropertyOptional({ description: 'Slug do supermercado (single)' })
  @IsOptional()
  @IsString()
  @Matches(SLUG_OR_CUID_PATTERN, { message: 'supermarket must be a slug or cuid' })
  supermarket?: string;

  @ApiPropertyOptional({
    description:
      'Múltiplos supermercados por vírgula (ex: `mercadona,dia`). Alternativa a `supermarket` quando user quer OR de várias redes.',
    example: 'mercadona,dia',
  })
  @IsOptional()
  @Transform(toSlugArray)
  @IsArray()
  @ArrayMaxSize(10)
  supermarkets?: string[];

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  brand?: string;

  @ApiPropertyOptional({ description: 'Preço mínimo em € (inclusivo)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Preço máximo em € (inclusivo)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  onPromotion?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isVegan?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isVegetarian?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isGlutenFree?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isLactoseFree?: boolean;

  @ApiPropertyOptional({
    description:
      'Nutri-Score mínimo aceitável (A é melhor; filtro inclusivo — A=só A, B=A+B, etc).',
    enum: ['A', 'B', 'C', 'D', 'E'],
  })
  @IsOptional()
  @IsIn(['A', 'B', 'C', 'D', 'E'])
  nutriScore?: 'A' | 'B' | 'C' | 'D' | 'E';

  @ApiPropertyOptional({
    enum: ['cheapest', 'newest', 'name', 'nutriScore'],
    default: 'cheapest',
  })
  @IsOptional()
  @IsIn(['cheapest', 'newest', 'name', 'nutriScore'])
  sortBy?: 'cheapest' | 'newest' | 'name' | 'nutriScore';
}
