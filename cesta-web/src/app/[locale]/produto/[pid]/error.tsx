"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common.error.boundary");
  const tProduct = useTranslations("product");

  useEffect(() => {
    // Sprint 227 (#10 bundle): segment error boundaries do Next 16 capturam
    // o erro ANTES do SentryBoundary root (special file hierarchy) — sem
    // capture explícito aqui o crash nunca chega no Sentry e QA fica cego.
    // ADR vinculada S227 resumir; fix idempotente (no-op se init skipped).
    Sentry.captureException(error, {
      tags: { route: "produto/[pid]", boundary: "segment" },
      extra: { digest: error.digest },
    });
    console.error("[produto/[pid]] render error", error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="font-display text-xl font-bold text-ink">{t("title")}</p>
      <p className="max-w-sm text-sm text-muted">{t("body")}</p>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => reset()}>
          {t("retry")}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">{tProduct("backHome")}</Link>
        </Button>
      </div>
    </main>
  );
}
