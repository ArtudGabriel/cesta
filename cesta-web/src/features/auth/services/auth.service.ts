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

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const { data } = await api.post<Envelope<AuthResponse>>("/auth/refresh", {
      refreshToken,
    });
    return data.data;
  },

  async logout(refreshToken?: string): Promise<void> {
    await api.post("/auth/logout", refreshToken ? { refreshToken } : {});
  },

  async me(): Promise<AuthUser> {
    const { data } = await api.get<Envelope<AuthUser>>("/auth/me");
    return data.data;
  },
};
