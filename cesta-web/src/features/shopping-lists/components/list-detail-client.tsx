"use client";

import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  NutriFilters,
  isHealthyGrade,
  nutriSortValue,
} from "@/features/catalog/components/nutri-filters";
import { UnitSortToggle } from "@/features/catalog/components/unit-sort-toggle";
import { useNutriPreferences } from "@/features/profile/hooks/use-nutri-preferences";
import { useSortUnitPreference } from "@/features/profile/hooks/use-sort-unit-preference";
import {
  useDeleteList,
  useList,
  useListTotals,
} from "../hooks/use-shopping-lists";
import type { ShoppingList } from "../types/shopping-list.types";
import { AddProductModal } from "./add-product-modal";
import { ListItemRow } from "./list-item-row";
import { TotalsByMarket } from "./totals-by-market";

interface ListDetailClientProps {
  initialList: ShoppingList;
}

export function ListDetailClient({ initialList }: ListDetailClientProps) {
  const router = useRouter();
  // initialData evita loading flash — useList bate /shopping-lists/:id em
  // background e revalida se mudou (totals continua separado em useListTotals).
  // Fallback `list = initialList` mantido: TanStack v5 narrowing pra
  // DefinedUseQueryResult exige initialData **required** no overload, mas
  // useList recebe `options?.initialData` optional pra manter API flexível —
  // TS infere `T | undefined` e precisamos do default pra evitar `possibly
  // undefined` nos consumers. Sprint 60 avaliou remover (nit Reviewer) mas
  // narrowing não funciona com signature atual; revert documentado.
  const { data: list = initialList } = useList(initialList.id, {
    initialData: initialList,
  });
  const { data: totals } = useListTotals(initialList.id);
  const deleteList = useDeleteList();
  const [showAdd, setShowAdd] = useState(false);
  const { value: sortMode, setValue: setSortMode } = useSortUnitPreference();
  const nutri = useNutriPreferences();
  const sortByNutri = nutri.sortEnabled;
  const setSortByNutri = nutri.setSortEnabled;
  const onlyHealthy = nutri.healthyOnly;
  const setOnlyHealthy = nutri.setHealthyOnly;
  const t = useTranslations("myList");
  const tNav = useTranslations("nav");

  const sortedItems = useMemo(() => {
    const items = list?.items ?? [];
    const filtered = onlyHealthy
      ? items.filter((it) => isHealthyGrade(it.product.nutriScore?.grade))
      : items;
    if (sortByNutri) {
      return filtered
        .slice()
        .sort(
          (a, b) =>
            nutriSortValue(a.product.nutriScore?.grade) -
            nutriSortValue(b.product.nutriScore?.grade),
        );
    }
    if (sortMode === "absolute") return filtered;
    return filtered.slice().sort((a, b) => {
      const au = a.product.cheapestUnitPrice?.value ?? Infinity;
      const bu = b.product.cheapestUnitPrice?.value ?? Infinity;
      return au - bu;
    });
  }, [list?.items, sortMode, sortByNutri, onlyHealthy]);

  return (
    <main className="flex-1 pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label={tNav("back")}>
          <Link href="/minha-lista">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1
          data-sentry-mask
          className="line-clamp-1 flex-1 font-display text-lg font-bold text-ink"
        >
          {list.name}
        </h1>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("deleteList")}
          onClick={() => {
            if (confirm(t("confirmDelete"))) {
              deleteList.mutate(list.id, {
                onSuccess: () => router.push("/minha-lista"),
              });
            }
          }}
        >
          <Trash2 className="h-5 w-5 text-coral" />
        </Button>
      </header>

      <div className="px-4 py-2">
        <Button className="w-full" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          {t("addProduct")}
        </Button>
      </div>

      <section className="px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("productsHeader", {
              count: list.items?.length ?? 0,
              units: (list.items ?? []).reduce((sum, i) => sum + i.quantity, 0),
            })}
          </h2>
          {list.items && list.items.length > 1 && (
            <UnitSortToggle
              value={sortMode}
              onChange={setSortMode}
              variant="compact"
              disabled={sortByNutri}
            />
          )}
        </div>
        {list.items && list.items.length > 1 && (
          <div className="mb-3">
            <NutriFilters
              sortByNutri={sortByNutri}
              onSortByNutriChange={setSortByNutri}
              onlyHealthy={onlyHealthy}
              onOnlyHealthyChange={setOnlyHealthy}
            />
          </div>
        )}
        {list.items && list.items.length > 0 ? (
          // Sprint 59 GDPR: combinação produtos+quantidades pode revelar
          // contexto médico (ex: fraldas qty alta = bebê). Nome produto é
          // público, mas scope-row mascarado é mais seguro.
          <div className="space-y-2" data-sentry-mask>
            {sortedItems.map((item) => (
              <ListItemRow key={item.id} listId={list.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted">{t("emptyItems")}</p>
        )}
      </section>

      {totals && list.items && list.items.length > 0 && (
        <section className="px-4 py-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("totalsHeader")}
          </h2>
          <TotalsByMarket totals={totals} />
        </section>
      )}

      <AddProductModal
        listId={list.id}
        open={showAdd}
        onClose={() => setShowAdd(false)}
      />
    </main>
  );
}
