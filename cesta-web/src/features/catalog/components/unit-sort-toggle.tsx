"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type UnitSortMode = "absolute" | "unit";

interface UnitSortToggleProps {
  value: UnitSortMode;
  onChange: (mode: UnitSortMode) => void;
  variant?: "pills" | "compact";
  className?: string;
  disabled?: boolean;
}

export function UnitSortToggle({
  value,
  onChange,
  variant = "pills",
  className,
  disabled = false,
}: UnitSortToggleProps) {
  const t = useTranslations("compare");

  if (variant === "compact") {
    return (
      <div
        role="radiogroup"
        aria-label={t("sortAbsolute") + " / " + t("sortUnit")}
        className={cn("inline-flex items-center gap-2 text-xs text-muted", className)}
      >
        {(["absolute", "unit"] as const).map((mode) => {
          const active = !disabled && value === mode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(mode)}
              className={cn(
                "rounded-pill px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors",
                active
                  ? "bg-cesta-green text-white"
                  : "bg-surface text-muted hover:text-ink",
                disabled && "cursor-not-allowed opacity-40",
              )}
            >
              {mode === "absolute" ? t("sortAbsolute") : t("sortUnit")}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("sortAbsolute") + " / " + t("sortUnit")}
      className={cn("flex gap-2", className)}
    >
      {(["absolute", "unit"] as const).map((mode) => {
        const active = !disabled && value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(mode)}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center rounded-pill px-4 text-sm font-medium cursor-pointer transition-colors",
              active
                ? "bg-cesta-green text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
              disabled && "cursor-not-allowed opacity-40",
            )}
          >
            {mode === "absolute" ? t("sortAbsolute") : t("sortUnit")}
          </button>
        );
      })}
    </div>
  );
}
