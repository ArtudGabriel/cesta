import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Length, Matches, MaxLength, Min, ValidateIf } from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.validator';

export class UpdateReceiptItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'null = desvincular produto' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsCuid()
  productId?: string | null;
}

export class UpdateReceiptMetaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{1,64}$/, { message: 'supermarketSlug must be a slug' })
  supermarketSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  @MaxLength(500)
  notes?: string;
}
