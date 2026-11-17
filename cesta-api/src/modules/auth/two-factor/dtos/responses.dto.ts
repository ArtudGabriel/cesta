export interface EnrollResponseDto {
  secret: string;
  qrCodeDataUri: string;
  otpauthUrl: string;
}

export interface VerifyResponseDto {
  enabled: true;
  backupCodes: string[];
}

export interface DisableResponseDto {
  enabled: false;
}

export interface TwoFactorChallengeResponseDto {
  status: '2FA_REQUIRED';
  partialToken: string;
}
