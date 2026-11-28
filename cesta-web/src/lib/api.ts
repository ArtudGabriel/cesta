import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import * as Sentry from "@sentry/nextjs";

// Sprint 71: 45s pra absorver cold start do Render free tier (~30s pior caso).
// Keep-alive cron reduz probabilidade, mas o primeiro user pós-spin-down
// precisa de folga. Timeout mais baixo quebra GETs legítimos nesse cenário.
export const API_TIMEOUT_MS = 45000;

// Sprint 243c (ADR 0045): baseURL relativo pro proxy Next rewrite
// (/api/v1 mesmo-origin). Preserva o default local http://localhost:3001
// por desenvolvedores que ainda não rodam Next em modo rewrite, mas em
// prod o default `/api/v1` casa com o rewrite de next.config.ts.
const DEFAULT_API_BASE_URL =
  process.env.NODE_ENV === "production" ? "/api/v1" : "http://localhost:3001/api/v1";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
  // fetch adapter garante intercept por MSW (setupServer/fetch) em testes jsdom.
  // Em browser real axios escolhe XHR — zero diff funcional.
  adapter: "fetch",
  // Sprint 243c (ADR 0045): same-origin via Next rewrite — withCredentials
  // ainda é necessário pra garantir que o browser INCLUA o cookie first-party
  // nos XHRs (axios/fetch não envia cookies por default mesmo same-origin).
  // Refresh token httpOnly (Sprint 54 · set pelo backend sem Domain attr).
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
 * frontend traduzir via i18n; `message` é fallback do backend. `meta`
 * carrega dados estruturados do AppException (Sprint 90 usa pra
 * ACCOUNT_SOFT_DELETED com deletedAt + graceEndsAt).
 */
export class ApiError extends Error {
  readonly errorCode?: string;
  readonly statusCode?: number;
  readonly meta?: Record<string, unknown>;
  constructor(
    message: string,
    errorCode?: string,
    statusCode?: number,
    meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.meta = meta;
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
  // Sprint 80: Render free tier spin-down costuma emitir ECONNRESET quando
  // o socket vem de uma conexão keep-alive morta. Antes, só ECONNABORTED
  // (timeout) e ERR_NETWORK (fetch genérico) eram cobertos — reset ficava
  // sem retry e o user via erro no primeiro GET pós cold-start.
  return (
    error.code === "ECONNABORTED" ||
    error.code === "ERR_NETWORK" ||
    error.code === "ECONNRESET"
  );
}

// Sprint 87: singleflight via Promise compartilhada. N requests paralelas
// pegam o mesmo `refreshPromise` em vôo → 1 único POST /auth/refresh. Resolve
// race condition entre o check `isRefreshing` + a atribuição (flag padrão
// permite dupla entrada em runtimes com microtasks interleaved). Promise é
// atômica por semântica de JS.
let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
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

/** @internal exportado pra teste unitário. */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (
    error: AxiosError<{
      message?: string;
      errorCode?: string;
      meta?: Record<string, unknown>;
    }>,
  ) => {
    const original = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    if (shouldRetryOnNetworkError(error, original) && original) {
      original._networkRetried = true;
      // Sprint 80: breadcrumb pra correlação no Sentry quando retry ainda
      // falha. Não loga PII — só método, path relativo e código de erro.
      Sentry.addBreadcrumb({
        category: "retry",
        level: "info",
        message: "api retry on network error",
        data: {
          method: (original.method ?? "get").toUpperCase(),
          url: original.url,
          code: error.code,
        },
      });
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
      // Singleflight: todas as 401 paralelas aguardam o mesmo refresh in-flight.
      // Falha única = todas falham; sucesso único = todas retomam com novo token.
      const newToken = await refreshAccessToken();
      if (!newToken) {
        setAccessToken(null);
        return Promise.reject(buildApiError(error));
      }
      original._retried = true;
      original.headers = {
        ...original.headers,
        Authorization: `Bearer ${newToken}`,
      };
      return api.request(original);
    }

    return Promise.reject(buildApiError(error));
  },
);

function buildApiError(
  error: AxiosError<{
    message?: string;
    errorCode?: string;
    meta?: Record<string, unknown>;
  }>,
): ApiError {
  const message =
    error.response?.data?.message ?? error.message ?? "Erro de rede";
  const errorCode = error.response?.data?.errorCode;
  const meta = error.response?.data?.meta;
  return new ApiError(message, errorCode, error.response?.status, meta);
}
