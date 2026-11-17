"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useProducts } from "@/features/catalog/hooks/use-catalog";
import { cn, formatPrice } from "@/lib/utils";

interface ReplaceItemSheetProps {
  open: boolean;
  onClose: () => void;
  onPick: (productId: string) => void;
  currentProductId: string | null;
}

export function ReplaceItemSheet({
  open,
  onClose,
  onPick,
  currentProductId,
}: ReplaceItemSheetProps) {
  const [q, setQ] = useState("");
  const results = useProducts({ search: q || undefined, limit: 20 });
  const t = useTranslations("familyBasket");
  const tAria = useTranslations("common.aria");

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      role="presentation"
      className="fixed inset-0 z-50 flex items-end bg-black/50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl bg-cream p-4 md:max-w-lg md:rounded-2xl"
        data-sentry-mask
      >
        <div className="mb-3 flex items-center justify-between" data-sentry-unmask>
          <h3 className="font-display text-lg font-semibold text-ink">
            {t("replaceTitle")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={tAria("close")}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mb-3" data-sentry-unmask>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("replaceSearchPlaceholder")}
            className="pl-9"
          />
        </div>

        <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
          {results.isPending ? (
            Array.from({ length: 4 }).map((_, i) => (
              <li
                key={i}
                className="h-16 animate-pulse rounded-card bg-white/60"
              />
            ))
          ) : (results.data?.items ?? []).length === 0 ? (
            <li className="rounded-card bg-white p-4 text-center text-sm text-muted">
              {t("replaceEmpty")}
            </li>
          ) : (
            results.data!.items.map((p) => {
              const isCurrent = p.id === currentProductId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={isCurrent}
                    onClick={() => {
                      onPick(p.id);
                      onClose();
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-card bg-white p-3 text-left shadow-card transition-colors",
                      isCurrent
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-surface cursor-pointer",
                    )}
                  >
                    <div className="h-10 w-10 flex-shrink-0 rounded-btn bg-surface" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-ink">
                        {p.name}
                      </p>
                      <p className="text-xs text-muted">
                        {p.cheapestPrice != null
                          ? formatPrice(p.cheapestPrice)
                          : "—"}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
