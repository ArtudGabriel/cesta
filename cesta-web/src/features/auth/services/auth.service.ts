import { api } from "@/lib/api";
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

/**
 * Refresh token agora é cookie httpOnly (Sprint 54) — browser envia
 * automaticamente em cada call desde que axios tenha withCredentials: true
 * (lib/api.ts). Response body não traz mais refreshToken.
 */
export const authService = {
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { data } = await api.post<Envelope<AuthResponse>>(
      "/auth/register",
      payload,
    );
    return data.data;
  },

  async login(payload: LoginPayload): Promise<LoginResponse> {
    const { data } = await api.post<Envelope<LoginResponse>>(
      "/auth/login",
      payload,
    );
    return data.data;
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
