import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class DisableTwoFactorDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({ example: '123456', pattern: '^[0-9]{6}$' })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  code!: string;
}
