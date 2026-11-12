import { ApiProperty } from '@nestjs/swagger';

export class PriceHistoryPointDto {
  @ApiProperty({ example: '2026-11-01T00:00:00.000Z' })
  date: string;

  @ApiProperty({ example: 0.95 })
  price: number;

  @ApiProperty()
  onPromotion: boolean;
}

export class PriceHistorySeriesDto {
  @ApiProperty()
  supermarketId: string;

  @ApiProperty()
  supermarketSlug: string;

  @ApiProperty()
  supermarketName: string;

  @ApiProperty({ nullable: true })
  supermarketColor: string | null;

  @ApiProperty({ type: [PriceHistoryPointDto] })
  points: PriceHistoryPointDto[];
}
