export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  locale: "es" | "pt-BR";
  roles: string[];
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
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
