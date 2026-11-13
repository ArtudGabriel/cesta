"use client";

import { Leaf, Scale, TrendingUp, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useUpdateProfile } from "../hooks/use-profile";

type RowKey = "sortUnit" | "healthyOnly" | "sortNutri";

interface Row {
  key: RowKey;
  Icon: LucideIcon;
  value: boolean;
  payload: Record<string, unknown>;
}

interface Profile {
  sortUnitPreference: "absolute" | "unit";
  nutriSortEnabled: boolean;
  nutriHealthyOnly: boolean;
}

export function DisplayPreferencesSection({ profile }: { profile: Profile }) {
  const t = useTranslations("profile.displayPrefs");
  const update = useUpdateProfile();
  const [pending, setPending] = useState<RowKey | null>(null);

  const rows: Row[] = [
    {
      key: "sortUnit",
      Icon: Scale,
      value: profile.sortUnitPreference === "unit",
      payload: {
        sortUnitPreference:
          profile.sortUnitPreference === "unit" ? "absolute" : "unit",
      },
    },
    {
      key: "healthyOnly",
      Icon: Leaf,
      value: profile.nutriHealthyOnly,
      payload: { nutriHealthyOnly: !profile.nutriHealthyOnly },
    },
    {
      key: "sortNutri",
      Icon: TrendingUp,
      value: profile.nutriSortEnabled,
      payload: { nutriSortEnabled: !profile.nutriSortEnabled },
    },
  ];

  async function toggle(row: Row) {
    setPending(row.key);
    try {
      await update.mutateAsync(row.payload);
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="px-4 pt-4">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
        {t("title")}
      </h2>
      <div className="rounded-card bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs text-muted">{t("subtitle")}</p>
        <ul className="divide-y divide-neutral-100">
          {rows.map((row) => {
            const { Icon } = row;
            const isPending = pending === row.key;
            return (
              <li key={row.key} className="flex items-start gap-3 py-3">
                <Icon className="mt-0.5 h-5 w-5 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{t(row.key)}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {t(`${row.key}Help`)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(row)}
                  disabled={isPending}
                  role="switch"
                  aria-checked={row.value}
                  aria-label={t(row.key)}
                  className={cn(
                    "relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60",
                    row.value ? "bg-cesta-green" : "bg-neutral-300",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
                      row.value ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
