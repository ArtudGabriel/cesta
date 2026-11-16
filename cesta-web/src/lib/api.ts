import axios, { AxiosError, type AxiosRequestConfig } from "axios";

// Sprint 71: 45s pra absorver cold start do Render free tier (~30s pior caso).
// Keep-alive cron reduz probabilidade, mas o primeiro user pós-spin-down
// precisa de folga. Timeout mais baixo quebra GETs legítimos nesse cenário.
export const API_TIMEOUT_MS = 45000;

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1",
  timeout: API_TIMEOUT_MS,
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

/**
 * Sprint 60: refresh interceptor queue — garante único /auth/refresh in-flight
 * mesmo com múltiplas requests paralelas pegando 401. Requests pendentes
 * esperam pelo mesmo refresh, retomam com o novo access token OU falham
 * juntas se refresh der 401 (sessão realmente expirou).
 */
interface RetryableConfig extends AxiosRequestConfig {
  _retried?: boolean;
  _networkRetried?: boolean;
}

// Sprint 71: single retry em erros de rede/timeout, GET-only, pra blindar
// cold start e flaps de conexão. Idempotência garante correção; writes ficam
// de fora pra evitar duplicata silenciosa.
/** @internal exportado pra teste unitário. */
export function shouldRetryOnNetworkError(
  error: AxiosError,
  config: RetryableConfig | undefined,
): boolean {
  if (!config) return false;
  if (config._networkRetried) return false;
  if (error.response) return false;
  const method = (config.method ?? "get").toLowerCase();
  if (method !== "get") return false;
  return error.code === "ECONNABORTED" || error.code === "ERR_NETWORK";
}

let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

function flushQueue(token: string | null) {
  pendingQueue.forEach((cb) => cb(token));
  pendingQueue = [];
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    // Chamada crua (sem axios interceptor pra evitar loop infinito em 401).
    const res = await fetch(`${api.defaults.baseURL ?? ""}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data: { tokens: { accessToken: string } };
    };
    const token = json.data?.tokens?.accessToken ?? null;
    if (token) setAccessToken(token);
    return token;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (
    error: AxiosError<{
      message?: string;
      errorCode?: string;
    }>,
  ) => {
    const original = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    if (shouldRetryOnNetworkError(error, original) && original) {
      original._networkRetried = true;
      return api.request(original);
    }

    // 401 fora de window (SSR) ou request já retentada → falha direto.
    // Sprint 72: user anônimo (sem access token em storage) não deve
    // disparar refresh — rotas catálogo são públicas; 401 em rota protegida
    // acessada por anon = decisão do produto (modal LoginGate), não refresh.
    const hasPriorSession =
      typeof window !== "undefined" && getAccessToken() !== null;
    const canRetry =
      status === 401 &&
      typeof window !== "undefined" &&
      hasPriorSession &&
      original &&
      !original._retried &&
      // Não retry em chamadas de auth (login/refresh/logout) pra evitar loops.
      !(original.url?.includes("/auth/login") ?? false) &&
      !(original.url?.includes("/auth/refresh") ?? false) &&
      !(original.url?.includes("/auth/register") ?? false);

    if (canRetry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push((token) => {
            if (!token) {
              reject(buildApiError(error));
              return;
            }
            original._retried = true;
            original.headers = {
              ...original.headers,
              Authorization: `Bearer ${token}`,
            };
            resolve(api.request(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        if (!newToken) {
          flushQueue(null);
          setAccessToken(null);
          return Promise.reject(buildApiError(error));
        }
        flushQueue(newToken);
        original._retried = true;
        original.headers = {
          ...original.headers,
          Authorization: `Bearer ${newToken}`,
        };
        return api.request(original);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(buildApiError(error));
  },
);

function buildApiError(
  error: AxiosError<{ message?: string; errorCode?: string }>,
): ApiError {
  const message =
    error.response?.data?.message ?? error.message ?? "Erro de rede";
  const errorCode = error.response?.data?.errorCode;
  return new ApiError(message, errorCode, error.response?.status);
}
