"use client";

import { useTranslations } from "next-intl";
import { ApiError } from "./api";

type TranslateFn = ReturnType<typeof useTranslations>;

/**
 * Mapeia errorCode namespaced do backend pra chave i18n `errors.<ns>.<key>`.
 * Ex: "AUTH.INVALID_CREDENTIALS" → "auth.invalidCredentials"
 *     "FAMILY_PROFILE.NOT_FOUND" → "familyProfile.notFound"
 */
function toCamel(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function errorCodeToI18nKey(errorCode: string): string {
  const parts = errorCode.toLowerCase().split(".");
  if (parts.length < 2) return "fallback";
  const ns = toCamel(parts[0]);
  const key = toCamel(parts.slice(1).join("_"));
  return `${ns}.${key}`;
}

/**
 * Traduz erro da API usando i18n. Se `errorCode` conhecido → tradução;
 * se `ApiError` sem `errorCode` (ex: 404 Nest default, 502 gateway) →
 * `fallback` genérico — nunca vaza mensagem HTTP crua do backend pro user
 * (regressão S102 → S103: raw `Cannot POST /api/v1/users/me/import`). Erros
 * JS puros (não-`ApiError`) ainda expõem `message` porque são bugs de código
 * que o dev precisa ver no console.
 *
 * Uso típico em hook.onError: `toast.error(translateError(err, t))`.
 * `t` deve ser o retorno de `useTranslations("errors")`.
 */
export function translateError(err: unknown, t: TranslateFn): string {
  if (err instanceof ApiError) {
    if (err.errorCode) {
      const key = errorCodeToI18nKey(err.errorCode);
      const has = (t as unknown as { has?: (k: string) => boolean }).has;
      if (typeof has === "function" ? has.call(t, key) : true) {
        try {
          return t(key);
        } catch {
          // fallthrough pra fallback
        }
      }
    }
    return t("fallback");
  }
  if (err instanceof Error && err.message) return err.message;
  return t("fallback");
}
