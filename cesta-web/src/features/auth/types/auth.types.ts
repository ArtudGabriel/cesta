export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  locale: "es" | "pt-BR";
  roles: string[];
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface RegisterPayload {
  email?: string;
  phone?: string;
  password: string;
  name?: string;
  locale?: "es" | "pt-BR";
}

export interface LoginPayload {
  email?: string;
  phone?: string;
  password: string;
}

export interface ReactivatePayload {
  email?: string;
  phone?: string;
  password: string;
}

export interface SoftDeletedMeta {
  deletedAt: string;
  graceEndsAt: string;
}

export interface TwoFactorChallengeResponse {
  status: "2FA_REQUIRED";
  partialToken: string;
}

export type LoginResponse = AuthResponse | TwoFactorChallengeResponse;

export function isTwoFactorChallenge(
  r: LoginResponse,
): r is TwoFactorChallengeResponse {
  return (
    (r as TwoFactorChallengeResponse).status === "2FA_REQUIRED" &&
    typeof (r as TwoFactorChallengeResponse).partialToken === "string"
  );
}

export interface TwoFactorEnrollResponse {
  secret: string;
  qrCodeDataUri: string;
  otpauthUrl: string;
}

export interface TwoFactorVerifyResponse {
  enabled: true;
  backupCodes: string[];
}

export interface TwoFactorDisableResponse {
  enabled: false;
}
