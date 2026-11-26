"use client";

import { ArrowLeft, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { useNutriPreferences } from "@/features/profile/hooks/use-nutri-preferences";
import { useSortUnitPreference } from "@/features/profile/hooks/use-sort-unit-preference";
import { useCompare } from "../hooks/use-compare";
import type { Product } from "../types/catalog.types";
import { ComparisonEmptyState } from "@/features/compare/components/comparison-empty-state";
import { CompareAddSheet } from "./compare-add-sheet";
import { CompareGrid, type ViewMode } from "./compare-grid";
import { CompareMatrix } from "./compare-matrix";
import { NutriFilters } from "./nutri-filters";

const MAX = 4;

interface CompareClientProps {
  initialIds: string[];
  initialData: Product[];
}

export function CompareClient({ initialIds, initialData }: CompareClientProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { value: sortMode, setValue: setSortMode } = useSortUnitPreference();
  const [viewMode, setViewMode] = useState<ViewMode>("prices");
  const nutri = useNutriPreferences();
  const sortByNutri = nutri.sortEnabled;
  const setSortByNutri = nutri.setSortEnabled;
  const onlyHealthy = nutri.healthyOnly;
  const setOnlyHealthy = nutri.setHealthyOnly;
  const t = useTranslations("compare");
  const tNav = useTranslations("nav");
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  const [ids, setIds] = useState<string[]>(initialIds);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [viewMode]);

  // initialData só é válido pra set inicial de ids. Se usuário add/remove,
  // useCompare refetch via queryFn — zero loading flash no load inicial SSR.
  // Sprint 202: initialData.length === 0 sinaliza falha SSR (page.tsx try/catch
  // degrade). Passar [] como initialData suprime o client refetch (staleTime
  // 5min). Omitimos initialData quando vazio pra deixar useCompare refetcha
  // client-side quando backend volta (ou mocks e2e respondem).
  const { data, isPending } = useCompare(ids, {
    initialData:
      initialData.length > 0 && ids.join(",") === initialIds.join(",")
        ? initialData
        : undefined,
  });

  const updateIds = useCallback(
    (next: string[]) => {
      setIds(next);
      const query = next.length > 0 ? `?products=${next.join(",")}` : "";
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
        <Button asChild size="icon" variant="ghost" aria-label={tNav("back")}>
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="flex-1 font-display text-lg font-bold text-ink">
          {t("title")}
        </h1>
        <span className="text-xs text-muted">
          {ids.length}/{MAX}
        </span>
        {isHydrated && !user && (
          <Button asChild size="sm" variant="secondary">
            <Link href={`/login?returnUrl=${encodeURIComponent(`/comparar${ids.length > 0 ? `?products=${ids.join(",")}` : ""}`)}`}>
              {tNav("login")}
            </Link>
          </Button>
        )}
      </header>

      <section className="px-4 pt-2">
        {isPending && ids.length > 0 ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
          </div>
        ) : ids.length < 2 ? (
          <ComparisonEmptyState
            count={ids.length}
            onAdd={() => setSheetOpen(true)}
          />
        ) : (
          <>
            <div
              className="mb-3 flex gap-2"
              role="radiogroup"
              aria-label={t("viewPrices") + " / " + t("viewMatrix") + " / " + t("viewNutrition")}
            >
              {(["prices", "matrix", "nutrition"] as const).map((mode) => {
                const active = viewMode === mode;
                const label =
                  mode === "prices"
                    ? t("viewPrices")
                    : mode === "matrix"
                      ? t("viewMatrix")
                      : t("viewNutrition");
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
                    {label}
                  </button>
                );
              })}
            </div>
            {viewMode === "prices" && (
              <div
                className="mb-3 flex gap-2"
                role="radiogroup"
                aria-label={t("sortAbsolute") + " / " + t("sortUnit")}
              >
                {(["absolute", "unit"] as const).map((mode) => {
                  const active = !sortByNutri && sortMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={sortByNutri}
                      onClick={() => setSortMode(mode)}
                      className={cn(
                        "inline-flex h-11 flex-1 items-center justify-center rounded-pill px-4 text-xs font-medium cursor-pointer transition-colors",
                        active
                          ? "bg-cesta-green text-white"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                        sortByNutri && "cursor-not-allowed opacity-40",
                      )}
                    >
                      {mode === "absolute" ? t("sortAbsolute") : t("sortUnit")}
                    </button>
                  );
                })}
              </div>
            )}
            <div className={cn("mb-3", viewMode === "matrix" && "hidden")}>
              <NutriFilters
                sortByNutri={sortByNutri}
                onSortByNutriChange={setSortByNutri}
                onlyHealthy={onlyHealthy}
                onOnlyHealthyChange={setOnlyHealthy}
              />
            </div>
            {viewMode === "matrix" ? (
              <CompareMatrix products={data ?? []} onRemove={remove} />
            ) : (
              <CompareGrid
                products={data ?? []}
                onRemove={remove}
                sortMode={sortMode}
                viewMode={viewMode}
                onSwitchToPrices={() => setViewMode("prices")}
                sortByNutri={sortByNutri}
                onlyHealthy={onlyHealthy}
              />
            )}
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

