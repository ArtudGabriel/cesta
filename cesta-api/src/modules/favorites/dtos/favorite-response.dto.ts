import { ApiProperty } from '@nestjs/swagger';
import { UnitPrice, UnitPriceSuffix } from '../../../common/utils/price-normalization';
import { NutriGrade } from '../../../common/utils/nutri-score';

export class NutriScoreDto {
  @ApiProperty({ example: -2 }) score: number;
  @ApiProperty({ example: 'A', enum: ['A', 'B', 'C', 'D', 'E'] })
  grade: NutriGrade;
}

export class UnitPriceDto {
  @ApiProperty({ example: 4.2 }) value: number;
  @ApiProperty({ example: 'L', enum: ['L', 'kg', '100g', '100ml', 'un'] })
  unit: UnitPriceSuffix;
}

export class CheapestPriceDto {
  @ApiProperty()
  price: number;

  @ApiProperty()
  supermarketSlug: string;

  @ApiProperty()
  supermarketName: string;

  @ApiProperty({ type: () => UnitPriceDto, nullable: true })
  unitPrice: UnitPrice | null;
}

export class FavoriteProductDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  brand: string | null;

  @ApiProperty({ nullable: true })
  imageUrl: string | null;

  @ApiProperty()
  isVegan: boolean;

  @ApiProperty()
  isVegetarian: boolean;

  @ApiProperty()
  isGlutenFree: boolean;

  @ApiProperty()
  isLactoseFree: boolean;

  @ApiProperty({ type: () => NutriScoreDto, nullable: true })
  nutriScore: { score: number; grade: NutriGrade } | null;
}

export class FavoriteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: () => FavoriteProductDto, required: false })
  product?: FavoriteProductDto;

  @ApiProperty({ type: () => CheapestPriceDto, required: false, nullable: true })
  cheapestPrice?: CheapestPriceDto | null;
}
