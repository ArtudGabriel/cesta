"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function FavoritesEmptyState() {
  const t = useTranslations("favorites");
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-card bg-white px-6 py-10 text-center shadow-sm"
      data-testid="favorites-empty-state"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
        <Heart className="h-8 w-8 text-coral" aria-hidden="true" />
      </div>
      <p className="font-display text-base font-bold text-ink">
        {t("emptyTitle")}
      </p>
      <p className="max-w-xs text-sm text-muted">{t("emptyBody")}</p>
      <Button asChild size="sm">
        <Link href="/" data-testid="favorites-empty-cta">
          {t("emptyCta")}
        </Link>
      </Button>
    </div>
  );
}

export function FavoritesFilteredEmptyState({
  onClear,
}: {
  onClear: () => void;
}) {
  const t = useTranslations("favorites");
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-card bg-white px-6 py-10 text-center shadow-sm"
      data-testid="favorites-filtered-empty-state"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
        <Heart className="h-8 w-8 text-muted" aria-hidden="true" />
      </div>
      <p className="font-display text-base font-bold text-ink">
        {t("emptyFilteredTitle")}
      </p>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onClear}
        data-testid="favorites-filtered-clear-cta"
      >
        {t("emptyFilteredCta")}
      </Button>
    </div>
  );
}
