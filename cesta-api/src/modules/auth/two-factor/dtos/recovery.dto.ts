import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class RecoveryTwoFactorDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  partialToken!: string;

  @ApiProperty({ example: 'A1B2C3D4E5', pattern: '^[A-Z0-9]{10}$' })
  @IsString()
  @Matches(/^[A-Z0-9]{10}$/)
  backupCode!: string;
}
