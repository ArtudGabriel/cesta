import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
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

export class CreateReceiptItemDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  rawText!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  normalizedName!: string;

  @ApiProperty({ minimum: 0.001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsCuid()
  productId?: string | null;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  categoryHint?: string | null;
}

export class UpdateReceiptMetaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Matches(/^[a-z0-9-]{1,64}$/, { message: 'supermarketSlug must be a slug' })
  supermarketSlug?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Date)
  @IsDate()
  purchaseDate?: Date | null;

  @ApiPropertyOptional({ description: 'override manual do total; null re-habilita autocompute' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  @MaxLength(500)
  notes?: string;
}
