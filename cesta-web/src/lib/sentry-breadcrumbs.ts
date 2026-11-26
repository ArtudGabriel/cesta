/**
 * Frontend Sentry breadcrumb emitters — Sprint 192 G2.
 *
 * GDPR S59 compliance: breadcrumbs NUNCA carregam PII do usuário ou texto
 * livre que o user digitou. Permitido: rota, status HTTP, bucket de tamanho
 * de query, slug de supermercado/categoria (público), resultcount, error code.
 * Proibido: texto da busca, email, nome, telefone, user ID, token, qualquer
 * campo listado em cesta.md §GDPR (PII user-visible).
 *
 * Emitters:
 *   - recordSuggestRequest: /products/suggest start/success/failure
 *   - recordProductsFetch: /products list por rota
 *   - recordAuthAttempt: login/register outcome
 *
 * Quando `@sentry/nextjs` init está ativo, breadcrumbs anexam aos próximos
 * events capturados. SSR sem DSN = Sentry virou no-op; emitters também são
 * seguros pra chamar (try/catch wrapper).
 */

import * as Sentry from "@sentry/nextjs";

export type SuggestStage = "start" | "success" | "failure";
export type AuthKind = "login" | "register";
export type AuthOutcome = "success" | "failure" | "challenge_2fa";

/**
 * Bucket do tamanho do query — evita leak do texto digitado mantendo signal
 * pra análise de UX (quantos chars o user tipa antes de desistir, etc).
 */
export function queryLengthBucket(q: string): string {
  const len = q.length;
  if (len === 0) return "0";
  if (len <= 2) return "1-2";
  if (len <= 5) return "3-5";
  if (len <= 10) return "6-10";
  return "11+";
}

function safeAddBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  try {
    Sentry.addBreadcrumb(breadcrumb);
  } catch {
    // Observability never breaks the caller flow.
  }
}

export function recordSuggestRequest(
  stage: SuggestStage,
  payload: {
    query: string;
    resultCount?: number;
    status?: number;
    errorCode?: string;
    durationMs?: number;
  },
): void {
  const data: Record<string, unknown> = {
    stage,
    q_len_bucket: queryLengthBucket(payload.query),
  };
  if (payload.resultCount != null) data.result_count = payload.resultCount;
  if (payload.status != null) data.status = payload.status;
  if (payload.errorCode) data.error_code = payload.errorCode;
  if (payload.durationMs != null) data.duration_ms = payload.durationMs;

  safeAddBreadcrumb({
    category: "api.suggest",
    type: stage === "failure" ? "error" : "http",
    level: stage === "failure" ? "warning" : "info",
    message: `suggest ${stage}`,
    data,
  });
}

/**
 * Filters liberados (whitelist pra incluir em breadcrumb):
 * - supermarket (slug público)
 * - category (slug público)
 * - sort (chave pública)
 * - page/limit (número)
 *
 * Qualquer outra key (incluindo `search`/`q` free-text) é dropada.
 */
const SAFE_FILTER_KEYS = new Set([
  "supermarket",
  "category",
  "sort",
  "page",
  "limit",
]);

export function sanitizeFilters(
  filters: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (!SAFE_FILTER_KEYS.has(k)) continue;
    if (v == null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    }
  }
  return out;
}

export function recordProductsFetch(payload: {
  route: string;
  filters?: Record<string, unknown>;
  resultCount?: number;
  total?: number;
  status?: number;
  errorCode?: string;
  durationMs?: number;
  success: boolean;
}): void {
  const data: Record<string, unknown> = {
    route: payload.route,
    success: payload.success,
  };
  if (payload.filters) {
    data.filters = sanitizeFilters(payload.filters);
  }
  if (payload.resultCount != null) data.result_count = payload.resultCount;
  if (payload.total != null) data.total = payload.total;
  if (payload.status != null) data.status = payload.status;
  if (payload.errorCode) data.error_code = payload.errorCode;
  if (payload.durationMs != null) data.duration_ms = payload.durationMs;

  safeAddBreadcrumb({
    category: "api.products",
    type: payload.success ? "http" : "error",
    level: payload.success ? "info" : "warning",
    message: `products ${payload.route} ${payload.success ? "ok" : "fail"}`,
    data,
  });
}

export function recordAuthAttempt(payload: {
  kind: AuthKind;
  outcome: AuthOutcome;
  status?: number;
  errorCode?: string;
  durationMs?: number;
}): void {
  const data: Record<string, unknown> = {
    kind: payload.kind,
    outcome: payload.outcome,
  };
  if (payload.status != null) data.status = payload.status;
  if (payload.errorCode) data.error_code = payload.errorCode;
  if (payload.durationMs != null) data.duration_ms = payload.durationMs;

  safeAddBreadcrumb({
    category: "api.auth",
    type: payload.outcome === "failure" ? "error" : "http",
    level: payload.outcome === "failure" ? "warning" : "info",
    message: `auth ${payload.kind} ${payload.outcome}`,
    data,
  });
}
