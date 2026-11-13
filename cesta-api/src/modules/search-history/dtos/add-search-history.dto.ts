import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class AddSearchHistoryDto {
  @ApiProperty({ example: 'aceite', minLength: 2, maxLength: 128 })
  @IsString()
  @Length(2, 128)
  @Matches(/^[\p{L}\p{M}\p{N}\s'.\-,%&/+]+$/u, {
    message: 'query contém caracteres inválidos',
  })
  query: string;
}

export class SearchHistoryItemDto {
  @ApiProperty() id: string;
  @ApiProperty() query: string;
  @ApiProperty() createdAt: Date;
}
