import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateListDto {
  @ApiProperty({ example: 'Compra de la semana' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;
}

export class UpdateListDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;
}
