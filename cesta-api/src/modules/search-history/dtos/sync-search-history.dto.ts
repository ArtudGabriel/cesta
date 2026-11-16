import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, Length, Matches } from 'class-validator';

export class SyncSearchHistoryDto {
  @ApiProperty({
    description:
      'Queries acumuladas em localStorage pré-login. Dedup+MRU no server; cap 10 preservado.',
    type: [String],
    example: ['aceite', 'leche'],
    maxItems: 50,
  })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Length(2, 128, { each: true })
  @Matches(/^[\p{L}\p{M}\p{N}\s'.\-,%&/+]+$/u, {
    each: true,
    message: 'cada query deve conter apenas caracteres válidos',
  })
  queries: string[];
}
