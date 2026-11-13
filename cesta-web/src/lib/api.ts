import axios, { AxiosError } from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
  // fetch adapter garante intercept por MSW (setupServer/fetch) em testes jsdom.
  // Em browser real axios escolhe XHR — zero diff funcional.
  adapter: "fetch",
});

const ACCESS_TOKEN_KEY = "cesta_access_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  else window.localStorage.removeItem(ACCESS_TOKEN_KEY);
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
