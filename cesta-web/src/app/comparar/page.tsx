"use client";

import { ArrowLeft, Loader2, Plus, Scale } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CompareAddSheet } from "@/features/catalog/components/compare-add-sheet";
import { CompareGrid, type ViewMode } from "@/features/catalog/components/compare-grid";
import { useCompare } from "@/features/catalog/hooks/use-compare";
import { useSortUnitPreference } from "@/features/profile/hooks/use-sort-unit-preference";
import { cn } from "@/lib/utils";

const MAX = 4;

export default function CompararPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <CompararContent />
    </Suspense>
  );
}

function CompararContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { value: sortMode, setValue: setSortMode } = useSortUnitPreference();
  const [viewMode, setViewMode] = useState<ViewMode>("prices");
  const t = useTranslations("compare");

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [viewMode]);

  const ids = useMemo(() => {
    const raw = searchParams.get("products") ?? "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX);
  }, [searchParams]);

  const { data, isPending } = useCompare(ids);

  const updateIds = useCallback(
    (next: string[]) => {
      const query =
        next.length > 0 ? `?products=${next.join(",")}` : "";
      router.replace(`/comparar${query}`, { scroll: false });
    },
    [router],
  );

  const add = useCallback(
    (productId: string) => {
      if (ids.includes(productId) || ids.length >= MAX) return;
      updateIds([...ids, productId]);
      setSheetOpen(false);
    },
    [ids, updateIds],
  );

  const remove = useCallback(
    (productId: string) => {
      updateIds(ids.filter((id) => id !== productId));
    },
    [ids, updateIds],
  );

  return (
    <main className="pb-16">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label="Volver">
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="flex-1 font-display text-lg font-bold text-ink">
          Comparar
        </h1>
        <span className="text-xs text-muted">
          {ids.length}/{MAX}
        </span>
      </header>

      <section className="px-4 pt-2">
        {isPending && ids.length > 0 ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
          </div>
        ) : ids.length < 2 ? (
          <EmptyState count={ids.length} onAdd={() => setSheetOpen(true)} />
        ) : (
          <>
            <div className="mb-3 flex gap-2" role="radiogroup" aria-label={t("viewPrices") + " / " + t("viewNutrition")}>
              {(["prices", "nutrition"] as const).map((mode) => {
                const active = viewMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      "inline-flex h-11 flex-1 items-center justify-center rounded-pill px-4 text-sm font-medium cursor-pointer transition-colors",
                      active
                        ? "bg-cesta-green text-white"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                    )}
                  >
                    {mode === "prices" ? t("viewPrices") : t("viewNutrition")}
                  </button>
                );
              })}
            </div>
            {viewMode === "prices" && (
              <div className="mb-3 flex gap-2" role="radiogroup" aria-label={t("sortAbsolute") + " / " + t("sortUnit")}>
                {(["absolute", "unit"] as const).map((mode) => {
                  const active = sortMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSortMode(mode)}
                      className={cn(
                        "inline-flex h-11 flex-1 items-center justify-center rounded-pill px-4 text-xs font-medium cursor-pointer transition-colors",
                        active
                          ? "bg-cesta-green text-white"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                      )}
                    >
                      {mode === "absolute" ? t("sortAbsolute") : t("sortUnit")}
                    </button>
                  );
                })}
              </div>
            )}
            <CompareGrid
              products={data ?? []}
              onRemove={remove}
              sortMode={sortMode}
              viewMode={viewMode}
              onSwitchToPrices={() => setViewMode("prices")}
            />
            {ids.length < MAX && (
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSheetOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Agregar otro producto
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <CompareAddSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        selectedIds={ids}
        onAdd={add}
        max={MAX}
      />
    </main>
  );
}

function LoadingShell() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
    </main>
  );
}

function EmptyState({
  count,
  onAdd,
}: {
  count: number;
  onAdd: () => void;
}) {
  const title =
    count === 0
      ? "Compara hasta 4 productos"
      : "Agrega al menos 1 producto más";
  const subtitle =
    count === 0
      ? "Agrega productos para ver precios lado a lado."
      : "Necesitas 2 productos como mínimo para comparar.";

  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-white px-6 py-10 text-center shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cesta-green/10">
        <Scale className="h-8 w-8 text-cesta-green opacity-70" />
      </div>
      <p className="font-display text-base font-bold text-ink">{title}</p>
      <p className="max-w-xs text-sm text-muted">{subtitle}</p>
      <Button type="button" size="sm" onClick={onAdd}>
        <Plus className="h-4 w-4" />
        Agregar producto
      </Button>
    </div>
  );
}
