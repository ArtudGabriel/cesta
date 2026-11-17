import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class ChallengeTwoFactorDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  partialToken!: string;

  @ApiProperty({ example: '123456', pattern: '^[0-9]{6}$' })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  code!: string;
}
