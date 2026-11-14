"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConsent } from "../hooks/use-consent";

/**
 * Sprint 62 GDPR: banner de consent antes de qualquer tracking/analytics.
 * - Fixo bottom acima da BottomNav (Sprint 7), tokens Cesta (bg-white,
 *   shadow-card-elevated, rounded-xl, cesta-green CTA primário).
 * - Render condicional via `useConsent()`: mostra enquanto `consent === null`
 *   (cookie ausente E profile.cookieConsentLevel vazio).
 * - `data-sentry-mask` no wrapper — regra permanente Sprint 59 (CLAUDE.md
 *   seção GDPR) — texto pode conter info legal / referência a políticas.
 * - Botões 44x44 touch (WCAG) per identidade-visual.md.
 */
export function CookieBanner() {
  const { consent, isReady, setConsent } = useConsent();
  const t = useTranslations("consent");

  if (!isReady || consent !== null) return null;

  return (
    <div
      data-sentry-mask
      role="dialog"
      aria-live="polite"
      aria-labelledby="cookie-banner-title"
      className="fixed inset-x-4 bottom-20 z-40 rounded-card bg-white p-4 shadow-card-elevated sm:inset-x-auto sm:right-4 sm:left-auto sm:max-w-md"
    >
      <p
        id="cookie-banner-title"
        className="font-display text-base font-bold text-ink"
      >
        {t("title")}
      </p>
      <p className="mt-1 text-sm text-muted">{t("description")}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-3">
        <Button
          type="button"
          className="min-h-11"
          onClick={() => void setConsent("all")}
        >
          {t("acceptAll")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          onClick={() => void setConsent("essential")}
        >
          {t("rejectNonEssential")}
        </Button>
      </div>
    </div>
  );
}
