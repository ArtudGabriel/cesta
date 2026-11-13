"use client";

import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

interface SentryBoundaryProps {
  children: ReactNode;
}

export function SentryBoundary({ children }: SentryBoundaryProps) {
  return (
    <Sentry.ErrorBoundary fallback={<BoundaryFallback />}>
      {children}
    </Sentry.ErrorBoundary>
  );
}

function BoundaryFallback() {
  const t = useTranslations("common.error.boundary");
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-xl font-bold text-ink">{t("title")}</p>
      <p className="max-w-sm text-sm text-muted">{t("body")}</p>
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") window.location.reload();
        }}
        className="inline-flex h-11 items-center justify-center rounded-pill bg-cesta-green px-5 text-sm font-semibold text-white cursor-pointer"
      >
        {t("retry")}
      </button>
    </main>
  );
}
