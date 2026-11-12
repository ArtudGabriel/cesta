import { ApiProperty } from '@nestjs/swagger';
import { IsCuid } from '../../../common/validators/is-cuid.validator';

export class AddFavoriteDto {
  @ApiProperty({ example: 'cmwcrquei003413n6em4rp09v' })
  @IsCuid()
  productId: string;
}
