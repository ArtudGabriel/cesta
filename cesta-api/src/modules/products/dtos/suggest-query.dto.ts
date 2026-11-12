import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { SEARCH_PATTERN } from './product-filters.dto';

export class SuggestQueryDto {
  @ApiProperty({ minLength: 2, maxLength: 128 })
  @IsString()
  @Length(2, 128)
  @Matches(SEARCH_PATTERN, { message: 'q contains invalid characters' })
  q: string;

  @ApiPropertyOptional({ default: 8, minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 8;
}

export class SuggestCheapestDto {
  @ApiProperty() value: number;
  @ApiProperty() supermarketSlug: string;
  @ApiProperty() supermarketName: string;
}

export class SuggestionDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) brand: string | null;
  @ApiProperty({ nullable: true }) imageUrl: string | null;
  @ApiProperty({ type: () => SuggestCheapestDto, nullable: true })
  cheapestPrice: SuggestCheapestDto | null;
}

export class SuggestResponseDto {
  @ApiProperty({ type: [SuggestionDto] })
  suggestions: SuggestionDto[];
}
