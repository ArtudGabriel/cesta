import { ApiProperty } from '@nestjs/swagger';

export class CheapestPriceDto {
  @ApiProperty()
  price: number;

  @ApiProperty()
  supermarketSlug: string;

  @ApiProperty()
  supermarketName: string;
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
