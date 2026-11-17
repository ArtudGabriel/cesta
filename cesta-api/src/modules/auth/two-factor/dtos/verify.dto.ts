import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class VerifyTwoFactorDto {
  @ApiProperty({ example: '123456', pattern: '^[0-9]{6}$' })
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'code deve ter exatamente 6 dígitos' })
  code!: string;
}
