"use client";

import { useTranslations } from "next-intl";
import type { DietaryQuestion } from "../types/family-basket.types";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  question: DietaryQuestion;
  locale: "es" | "pt-BR";
  value: boolean | string | undefined;
  onChange: (value: boolean | string) => void;
}

export function QuestionCard({
  question,
  locale,
  value,
  onChange,
}: QuestionCardProps) {
  const t = useTranslations("familyBasket.question");
  const label = locale === "pt-BR" ? question.labelPt : question.labelEs;

  if (question.type === "boolean") {
    const current = value === true;
    return (
      <div className="rounded-card bg-white p-4 shadow-card">
        <p className="mb-3 text-sm font-medium text-ink">{label}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={cn(
              "flex-1 rounded-btn py-2 text-sm font-medium cursor-pointer",
              current
                ? "bg-cesta-green text-white"
                : "bg-surface text-muted hover:text-ink",
            )}
          >
            {t("yes")}
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={cn(
              "flex-1 rounded-btn py-2 text-sm font-medium cursor-pointer",
              value === false
                ? "bg-cesta-green text-white"
                : "bg-surface text-muted hover:text-ink",
            )}
          >
            {t("no")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card bg-white p-4 shadow-card">
      <p className="mb-3 text-sm font-medium text-ink">{label}</p>
      <div className="space-y-2">
        {(question.options ?? []).map((opt) => {
          const lab = locale === "pt-BR" ? opt.labelPt : opt.labelEs;
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "w-full rounded-btn py-2 px-3 text-left text-sm font-medium cursor-pointer",
                selected
                  ? "bg-cesta-green text-white"
                  : "bg-surface text-ink hover:bg-border/40",
              )}
            >
              {lab}
            </button>
          );
        })}
      </div>
    </div>
  );
}
