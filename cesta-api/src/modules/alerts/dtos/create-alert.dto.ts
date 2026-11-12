import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.validator';

export const ALERT_TYPES = [
  'promotion',
  'target_price',
  'promotion_ending',
  'back_in_stock',
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

export class CreateAlertDto {
  @ApiProperty()
  @IsCuid()
  productId: string;

  @ApiPropertyOptional({ description: 'null = qualquer mercado' })
  @IsOptional()
  @IsCuid()
  supermarketId?: string;

  @ApiProperty({ enum: ALERT_TYPES })
  @IsIn(ALERT_TYPES as unknown as string[])
  type: AlertType;

  @ApiPropertyOptional({ description: 'Obrigatório se type=target_price' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  targetPrice?: number;
}

export class UpdateAlertDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  targetPrice?: number;
}
