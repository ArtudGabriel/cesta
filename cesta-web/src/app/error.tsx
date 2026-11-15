"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors.global");

  useEffect(() => {
    // Sprint 31 pattern + Sprint 59 GDPR: Sentry init gated on consent;
    // captureException é no-op quando init skipou.
    Sentry.captureException(error);
    // eslint-disable-next-line no-console
    console.error("[app/error] unhandled render error", error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="rounded-full bg-coral/15 p-6">
        <AlertTriangle
          className="h-12 w-12 text-coral"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
      <h1 className="font-display text-3xl font-bold text-ink">{t("title")}</h1>
      <p className="max-w-md text-sm text-muted">{t("body")}</p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex min-h-11 items-center rounded-pill bg-cesta-green px-6 text-sm font-semibold text-white hover:bg-cesta-green-dark"
      >
        {t("retry")}
      </button>
    </main>
  );
}
