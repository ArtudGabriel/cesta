import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class AddFavoriteDto {
  @ApiProperty({ example: 'cmwcrquei003413n6em4rp09v' })
  @IsString()
  @Length(1, 128)
  productId: string;
}
