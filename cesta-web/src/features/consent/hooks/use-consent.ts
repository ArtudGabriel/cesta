"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useProfile } from "@/features/profile/hooks/use-profile";
import type { CookieConsentLevel } from "@/features/profile/types/profile.types";

const CONSENT_COOKIE = "cesta:consent";
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

function readCookie(): CookieConsentLevel | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/cesta:consent=(all|essential)/);
  return (match?.[1] as CookieConsentLevel | undefined) ?? null;
}

function writeCookie(level: CookieConsentLevel): void {
  if (typeof document === "undefined") return;
  document.cookie = `${CONSENT_COOKIE}=${level}; path=/; max-age=${CONSENT_MAX_AGE}; samesite=lax`;
}

/**
 * Sprint 62 GDPR: estado local do consent com sync opcional pro backend.
 * Fonte de verdade = cookie `cesta:consent`. Se user logado e profile tem
 * cookieConsentLevel persistido, hidrata o cookie na primeira carga.
 */
export function useConsent() {
  const [consent, setConsentState] = useState<CookieConsentLevel | null>(null);
  const [isReady, setIsReady] = useState(false);
  const { data: profile } = useProfile();

  useEffect(() => {
    const cookie = readCookie();
    if (cookie) {
      setConsentState(cookie);
      setIsReady(true);
      return;
    }
    if (profile?.cookieConsentLevel) {
      writeCookie(profile.cookieConsentLevel);
      setConsentState(profile.cookieConsentLevel);
    }
    setIsReady(true);
  }, [profile]);

  const setConsent = useCallback(
    async (level: CookieConsentLevel) => {
      writeCookie(level);
      setConsentState(level);
      // Logado → persiste backend. Falha silenciosa: cookie já grava preferência
      // local, próximo login sincroniza.
      if (profile) {
        try {
          await api.post("/users/me/consent", { level });
        } catch {
          // No-op; cookie local é suficiente até próxima oportunidade de sync.
        }
      }
    },
    [profile],
  );

  return { consent, isReady, setConsent };
}
