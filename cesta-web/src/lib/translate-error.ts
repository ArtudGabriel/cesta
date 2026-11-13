"use client";

import { useTranslations } from "next-intl";
import { ApiError } from "./api";

type TranslateFn = ReturnType<typeof useTranslations>;

/**
 * Mapeia errorCode namespaced do backend pra chave i18n `errors.<ns>.<key>`.
 * Ex: "AUTH.INVALID_CREDENTIALS" → "errors.auth.invalidCredentials"
 */
function errorCodeToI18nKey(errorCode: string): string {
  const parts = errorCode.toLowerCase().split(".");
  if (parts.length < 2) return "fallback";
  const ns = parts[0];
  const key = parts
    .slice(1)
    .join("_")
    .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  return `${ns}.${key}`;
}

/**
 * Traduz erro da API usando i18n. Se errorCode conhecido → tradução; se
 * desconhecido → message original do backend; se nada → fallback genérico.
 *
 * Uso típico em hook.onError: `toast.error(translateError(err, t))`.
 * `t` deve ser o retorno de `useTranslations("errors")`.
 */
export function translateError(err: unknown, t: TranslateFn): string {
  if (err instanceof ApiError && err.errorCode) {
    const key = errorCodeToI18nKey(err.errorCode);
    // next-intl `has()` evita MISSING_MESSAGE throw em chaves ausentes.
    const has = (t as unknown as { has?: (k: string) => boolean }).has;
    if (typeof has === "function" ? has.call(t, key) : true) {
      try {
        return t(key);
      } catch {
        // fallthrough pra message/fallback
      }
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return t("fallback");
}
