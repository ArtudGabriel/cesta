"use client";

import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { UnitSortToggle } from "@/features/catalog/components/unit-sort-toggle";
import { useSortUnitPreference } from "@/features/profile/hooks/use-sort-unit-preference";
import { AddProductModal } from "@/features/shopping-lists/components/add-product-modal";
import { ListItemRow } from "@/features/shopping-lists/components/list-item-row";
import { TotalsByMarket } from "@/features/shopping-lists/components/totals-by-market";
import {
  useDeleteList,
  useList,
  useListTotals,
} from "@/features/shopping-lists/hooks/use-shopping-lists";

export default function ListDetailPage() {
  const params = useParams<{ id: string }>();
  const listId = params.id;

  const { data: list, isLoading } = useList(listId);
  const { data: totals } = useListTotals(listId);
  const deleteList = useDeleteList();
  const [showAdd, setShowAdd] = useState(false);
  const { value: sortMode, setValue: setSortMode } = useSortUnitPreference();
  const t = useTranslations("myList");
  const tNav = useTranslations("nav");

  const sortedItems = useMemo(() => {
    const items = list?.items ?? [];
    if (sortMode === "absolute") return items;
    return items.slice().sort((a, b) => {
      const au = a.product.cheapestUnitPrice?.value ?? Infinity;
      const bu = b.product.cheapestUnitPrice?.value ?? Infinity;
      return au - bu;
    });
  }, [list?.items, sortMode]);

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
      </main>
    );
  }

  if (!list) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-coral">{t("notFound")}</p>
        <Button asChild variant="secondary" size="sm">
          <Link href="/minha-lista">{t("backToLists")}</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label={tNav("back")}>
          <Link href="/minha-lista">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="line-clamp-1 flex-1 font-display text-lg font-bold text-ink">
          {list.name}
        </h1>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("deleteList")}
          onClick={() => {
            if (confirm(t("confirmDelete"))) {
              deleteList.mutate(list.id);
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
            {t("productsHeader", { count: list.items?.length ?? 0 })}
          </h2>
          {list.items && list.items.length > 1 && (
            <UnitSortToggle
              value={sortMode}
              onChange={setSortMode}
              variant="compact"
            />
          )}
        </div>
        {list.items && list.items.length > 0 ? (
          <div className="space-y-2">
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
