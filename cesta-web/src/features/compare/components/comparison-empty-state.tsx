"use client";

import { Plus, Scale } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface Props {
  count: number;
  onAdd: () => void;
}

export function ComparisonEmptyState({ count, onAdd }: Props) {
  const t = useTranslations("compare.empty");
  const isCount1 = count === 1;

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-card bg-white px-6 py-10 text-center shadow-sm"
      data-testid="comparison-empty-state"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cesta-green/10">
        <Scale
          className="h-8 w-8 text-cesta-green opacity-70"
          aria-hidden="true"
        />
      </div>
      <div className="space-y-1">
        <h2 className="font-display text-base font-bold text-ink">
          {isCount1 ? t("titleCount1") : t("title")}
        </h2>
        <p className="max-w-xs text-sm text-muted">
          {isCount1 ? t("bodyCount1") : t("body")}
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onAdd}
          data-testid="comparison-empty-cta-add"
        >
          <Plus className="h-4 w-4" />
          {t("ctaAdd")}
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href="/" data-testid="comparison-empty-cta-explore">
            {t("ctaExplore")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
