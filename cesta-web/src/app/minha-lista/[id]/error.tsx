"use client";

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
  const tList = useTranslations("myList");

  useEffect(() => {
    console.error("[minha-lista/[id]] render error", error);
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
          <Link href="/minha-lista">{tList("backToLists")}</Link>
        </Button>
      </div>
    </main>
  );
}
