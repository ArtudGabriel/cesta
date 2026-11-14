import axios, { AxiosError } from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
  // fetch adapter garante intercept por MSW (setupServer/fetch) em testes jsdom.
  // Em browser real axios escolhe XHR — zero diff funcional.
  adapter: "fetch",
  // Refresh token httpOnly (Sprint 54) — browser precisa incluir cookie em
  // cross-origin calls (web 3000, api 3001). Backend CORS já credentials:true.
  withCredentials: true,
});

const ACCESS_TOKEN_KEY = "cesta_access_token";
// JWT access expira em 15m (JWT_ACCESS_EXPIRES_IN). Cookie max-age casa com isso.
const COOKIE_MAX_AGE = 15 * 60;

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    // Mesmo cookie name que lib/api — Next.js RSC lê via next/headers cookies()
    // pra reconstruir Authorization: Bearer no fetch SSR. Não httpOnly porque
    // precisa setar do client; mesma superficie XSS que localStorage.
    document.cookie = `${ACCESS_TOKEN_KEY}=${token}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  } else {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    document.cookie = `${ACCESS_TOKEN_KEY}=; path=/; max-age=0; samesite=lax`;
  }
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Erro normalizado da API. Expõe `errorCode` namespaced (Sprint 38) pra
 * frontend traduzir via i18n; `message` é fallback do backend.
 */
export class ApiError extends Error {
  readonly errorCode?: string;
  readonly statusCode?: number;
  constructor(message: string, errorCode?: string, statusCode?: number) {
    super(message);
    this.name = "ApiError";
    this.errorCode = errorCode;
    this.statusCode = statusCode;
  }
}

api.interceptors.response.use(
  (response) => response,
  (
    error: AxiosError<{
      message?: string;
      errorCode?: string;
    }>,
  ) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      setAccessToken(null);
      // TODO: tentar refresh antes de redirecionar
    }
    const message =
      error.response?.data?.message ?? error.message ?? "Erro de rede";
    const errorCode = error.response?.data?.errorCode;
    return Promise.reject(
      new ApiError(message, errorCode, error.response?.status),
    );
  },
);
