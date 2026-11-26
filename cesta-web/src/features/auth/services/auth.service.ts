import { api } from "@/lib/api";
import { recordAuthAttempt } from "@/lib/sentry-breadcrumbs";
import type {
  AuthResponse,
  AuthUser,
  LoginPayload,
  LoginResponse,
  ReactivatePayload,
  RegisterPayload,
  TwoFactorDisableResponse,
  TwoFactorEnrollResponse,
  TwoFactorVerifyResponse,
} from "../types/auth.types";

interface Envelope<T> {
  data: T;
}

function authErrorCode(err: unknown): string | undefined {
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; errorCode?: unknown };
    if (typeof e.errorCode === "string") return e.errorCode;
    if (typeof e.code === "string") return e.code;
  }
  return undefined;
}

function authErrorStatus(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const e = err as { status?: unknown };
    if (typeof e.status === "number") return e.status;
  }
  return undefined;
}

function is2FAChallenge(response: LoginResponse): boolean {
  return (
    typeof response === "object" &&
    response !== null &&
    "status" in response &&
    (response as { status?: unknown }).status === "2FA_REQUIRED"
  );
}

/**
 * Refresh token agora é cookie httpOnly (Sprint 54) — browser envia
 * automaticamente em cada call desde que axios tenha withCredentials: true
 * (lib/api.ts). Response body não traz mais refreshToken.
 *
 * Sprint 192 G2: breadcrumbs Sentry sem PII (GDPR S59). Email/senha NUNCA
 * entram no payload — só kind + outcome + status + error code.
 */
export const authService = {
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const started = Date.now();
    try {
      const { data } = await api.post<Envelope<AuthResponse>>(
        "/auth/register",
        payload,
      );
      recordAuthAttempt({
        kind: "register",
        outcome: "success",
        status: 201,
        durationMs: Date.now() - started,
      });
      return data.data;
    } catch (err) {
      recordAuthAttempt({
        kind: "register",
        outcome: "failure",
        status: authErrorStatus(err),
        errorCode: authErrorCode(err),
        durationMs: Date.now() - started,
      });
      throw err;
    }
  },

  async login(payload: LoginPayload): Promise<LoginResponse> {
    const started = Date.now();
    try {
      const { data } = await api.post<Envelope<LoginResponse>>(
        "/auth/login",
        payload,
      );
      recordAuthAttempt({
        kind: "login",
        outcome: is2FAChallenge(data.data) ? "challenge_2fa" : "success",
        status: 200,
        durationMs: Date.now() - started,
      });
      return data.data;
    } catch (err) {
      recordAuthAttempt({
        kind: "login",
        outcome: "failure",
        status: authErrorStatus(err),
        errorCode: authErrorCode(err),
        durationMs: Date.now() - started,
      });
      throw err;
    }
  },

  async twoFactorEnroll(): Promise<TwoFactorEnrollResponse> {
    const { data } = await api.post<Envelope<TwoFactorEnrollResponse>>(
      "/auth/2fa/enroll",
      {},
    );
    return data.data;
  },

  async twoFactorVerify(code: string): Promise<TwoFactorVerifyResponse> {
    const { data } = await api.post<Envelope<TwoFactorVerifyResponse>>(
      "/auth/2fa/verify",
      { code },
    );
    return data.data;
  },

  async twoFactorChallenge(
    partialToken: string,
    code: string,
  ): Promise<AuthResponse> {
    const { data } = await api.post<Envelope<AuthResponse>>(
      "/auth/2fa/challenge",
      { partialToken, code },
    );
    return data.data;
  },

  async twoFactorRecovery(
    partialToken: string,
    backupCode: string,
  ): Promise<AuthResponse> {
    const { data } = await api.post<Envelope<AuthResponse>>(
      "/auth/2fa/recovery",
      { partialToken, backupCode },
    );
    return data.data;
  },

  async twoFactorDisable(
    password: string,
    code: string,
  ): Promise<TwoFactorDisableResponse> {
    const { data } = await api.post<Envelope<TwoFactorDisableResponse>>(
      "/auth/2fa/disable",
      { password, code },
    );
    return data.data;
  },

  async refresh(): Promise<AuthResponse> {
    const { data } = await api.post<Envelope<AuthResponse>>(
      "/auth/refresh",
      {},
    );
    return data.data;
  },

  async logout(): Promise<void> {
    await api.post("/auth/logout", {});
  },

  async me(): Promise<AuthUser> {
    const { data } = await api.get<Envelope<AuthUser>>("/auth/me");
    return data.data;
  },

  async verifyEmail(token: string): Promise<{ status: "verified" }> {
    const { data } = await api.post<Envelope<{ status: "verified" }>>(
      "/auth/verify-email",
      { token },
    );
    return data.data;
  },

  async resendVerification(): Promise<{
    status: "sent" | "already_verified" | "no_email";
  }> {
    const { data } = await api.post<
      Envelope<{ status: "sent" | "already_verified" | "no_email" }>
    >("/auth/resend-verification", {});
    return data.data;
  },

  async reactivateAccount(payload: ReactivatePayload): Promise<AuthResponse> {
    const { data } = await api.post<Envelope<AuthResponse>>(
      "/auth/reactivate-account",
      payload,
    );
    return data.data;
  },
};
