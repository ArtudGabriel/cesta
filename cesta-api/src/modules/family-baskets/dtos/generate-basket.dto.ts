import { ApiProperty } from '@nestjs/swagger';

export class GenerateBasketResponseDto {
  @ApiProperty() jobId: string;
  @ApiProperty({ example: 'queued' }) status: string;
  @ApiProperty() basketId: string;
}
