import type { Schemas } from "@/types/api";

/**
 * Sprint 212 — response types adotam baseline DTOs (S211 ADR 0024 saneou
 * `@ApiProperty({ nullable: true })` sem `type:` → zero leak em schemas
 * `Record<string, never>`). S212 fecha ciclo openapi-typescript S204-S212.
 *
 * Request payloads continuam Schemas (S210 ADR 0023). Response types abaixo
 * são aliases diretos em cima de `components["schemas"]` — zero paralelo.
 *
 * G3 (DoD S212): preservações locais:
 *   - `TwoFactorChallengeResponse` — baseline NÃO expõe DTO para resposta
 *     202/401 de login com 2FA (payload polimórfico `{ status, partialToken }`
 *     versus `TwoFactorAuthWireResponseDto` normal). Mantido handcrafted.
 *   - `isTwoFactorChallenge` — type-guard business-logic.
 */

export type AuthUser = Schemas["UserResponseDto"];

export type AuthTokens = Schemas["TwoFactorAccessTokenDto"];

export type AuthResponse = Schemas["TwoFactorAuthWireResponseDto"];

export type RegisterPayload = Schemas["RegisterDto"];

export type LoginPayload = Schemas["LoginDto"];

export type ReactivatePayload = Schemas["ReactivateAccountDto"];

export interface SoftDeletedMeta {
  deletedAt: string;
  graceEndsAt: string;
}

/** Baseline não cobre resposta 2FA-required (polimórfica). Keep local. */
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

export type TwoFactorEnrollResponse = Schemas["EnrollResponseDto"];

export type TwoFactorVerifyResponse = Schemas["VerifyResponseDto"];

export type TwoFactorDisableResponse = Schemas["DisableResponseDto"];
