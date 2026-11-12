import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.validator';

export class AddItemDto {
  @ApiProperty()
  @IsCuid()
  productId: string;

  @ApiPropertyOptional({ default: 1, minimum: 0.001 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class UpdateItemDto {
  @ApiProperty({ minimum: 0.001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;
}
