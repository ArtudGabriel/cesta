import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../../users/dtos/user-response.dto';

export class EnrollResponseDto {
  @ApiProperty({ description: 'Base32 TOTP secret (persistir no app autenticador)' })
  secret!: string;
  @ApiProperty({ description: 'Data URI do QR code pronto pra render <img>' })
  qrCodeDataUri!: string;
  @ApiProperty({ example: 'otpauth://totp/Cesta:user@example.com?secret=...&issuer=Cesta' })
  otpauthUrl!: string;
}

export class VerifyResponseDto {
  @ApiProperty({ example: true, description: '2FA ativado' })
  enabled!: true;
  @ApiProperty({
    type: [String],
    description: 'Backup codes one-time (mostrar só uma vez; hash no banco)',
  })
  backupCodes!: string[];
}

export class DisableResponseDto {
  @ApiProperty({ example: false })
  enabled!: false;
}

export class TwoFactorAccessTokenDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ example: 900 }) expiresIn!: number;
}

export class TwoFactorAuthWireResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
  @ApiProperty({ type: TwoFactorAccessTokenDto })
  tokens!: TwoFactorAccessTokenDto;
}

export class TwoFactorChallengeResponseDto {
  @ApiProperty({
    example: '2FA_REQUIRED',
    description: 'Sinal de 2ª fase; frontend chama /auth/2fa/challenge com partialToken',
  })
  status!: '2FA_REQUIRED';
  @ApiProperty({ description: 'Token opaco de curta duração (TTL ~5min)' })
  partialToken!: string;
}
