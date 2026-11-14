import { api } from "@/lib/api";
import type {
  AuthResponse,
  AuthUser,
  LoginPayload,
  RegisterPayload,
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

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await api.post<Envelope<AuthResponse>>(
      "/auth/login",
      payload,
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
};
