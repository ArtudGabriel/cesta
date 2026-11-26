import type { Schemas } from "@/types/api";

/**
 * Sprint 210 — request payloads adotam baseline DTOs (S209 ADR 0022).
 * Response types (AuthResponse/AuthUser/LoginResponse/2FA*Response)
 * permanecem handcrafted — baseline não anota esses endpoints com
 * @ApiResponse completo + sofre `Record<string, never> | null` leakage
 * em campos nullable (ADR 0023). Alvo S211+: backend @ApiResponse fix.
 */

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

export type RegisterPayload = Schemas["RegisterDto"];

export type LoginPayload = Schemas["LoginDto"];

export type ReactivatePayload = Schemas["ReactivateAccountDto"];

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
