"use client";

import Link from "next/link";
import { Bell, Receipt, ShoppingBasket } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CategoryChipSkeleton } from "@/features/catalog/components/category-chip-skeleton";
import { HomeEmptyState } from "@/features/catalog/components/home-empty-state";
import { ProductCard } from "@/features/catalog/components/product-card";
import { ProductCardSkeleton } from "@/features/catalog/components/product-card-skeleton";
import { SearchBar } from "@/features/catalog/components/search-bar";
import {
  useCategories,
  useProducts,
  useSupermarkets,
} from "@/features/catalog/hooks/use-catalog";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

type SortMode = "absolute" | "unit";

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [onPromotion, setOnPromotion] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("absolute");
  const t = useTranslations("home");

  const supermarkets = useSupermarkets();
  const categories = useCategories();
  const products = useProducts({
    search: search || undefined,
    category,
    onPromotion: onPromotion || undefined,
    limit: 20,
  });

  const sortedItems = useMemo(() => {
    const items = products.data?.items ?? [];
    if (sortMode === "absolute") return items;
    // Unit mode: sort by cheapestUnitPrice.value ASC; produtos sem unitPrice vão ao fim
    return items.slice().sort((a, b) => {
      const au = a.cheapestUnitPrice?.value ?? Infinity;
      const bu = b.cheapestUnitPrice?.value ?? Infinity;
      return au - bu;
    });
  }, [products.data, sortMode]);

  return (
    <main className="flex-1 flex flex-col px-4 py-6 pb-16">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-cesta-green">
            Cesta
          </h1>
          <p className="text-xs text-muted">Madrid · Supermercados</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Features primárias (Favoritos/Comparar/Mi lista/Mi cuenta/Inicio) migradas
              pra bottom-nav. Header mantém só atalhos secundários + ação de sessão. */}
          {isHydrated && user && (
            <>
              <Button asChild size="icon" variant="secondary" aria-label="Alertas">
                <Link href="/alertas">
                  <Bell className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="icon" variant="secondary" aria-label="Mis gastos">
                <Link href="/gastos">
                  <Receipt className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="icon" variant="secondary" aria-label="Mi Cesta familiar">
                <Link href="/minha-cesta">
                  <ShoppingBasket className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
          {isHydrated && !user && (
            <Button asChild size="sm">
              <Link href="/login">Entrar</Link>
            </Button>
          )}
        </div>
      </header>

      {/* Search */}
      <SearchBar value={search} onChange={setSearch} className="mb-4" />

      {/* Filters: supermarkets badges */}
      {supermarkets.data && (
        <div className="mb-3 flex flex-wrap gap-2">
          {supermarkets.data.map((sm) => (
            <span
              key={sm.id}
              className="rounded-pill px-3 py-1 text-[10px] font-medium text-white"
              style={{ backgroundColor: sm.color ?? "#1b6b48" }}
            >
              {sm.name}
            </span>
          ))}
        </div>
      )}

      {/* Categories */}
      <div className="-mx-4 mb-4 overflow-x-auto px-4">
        <div className="flex gap-2 pb-2">
          {categories.isPending ? (
            <>
              {Array.from({ length: 8 }).map((_, i) => (
                <CategoryChipSkeleton key={i} width={80 + (i % 3) * 24} />
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => setCategory(undefined)}
                className={`whitespace-nowrap rounded-pill px-3 py-2 text-xs font-medium cursor-pointer ${
                  !category
                    ? "bg-cesta-green text-white"
                    : "bg-surface text-muted hover:text-ink"
                }`}
              >
                Todas
              </button>
              {(categories.data ?? []).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.slug)}
                  className={`whitespace-nowrap rounded-pill px-3 py-2 text-xs font-medium cursor-pointer ${
                    category === c.slug
                      ? "bg-cesta-green text-white"
                      : "bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {c.nameEs}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Promotion toggle + sort mode */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={onPromotion}
            onChange={(e) => setOnPromotion(e.target.checked)}
            className="h-4 w-4 accent-cesta-green"
          />
          Solo en promoción
        </label>
        <div className="inline-flex items-center gap-2 text-xs text-muted">
          <span>{t("sortLabel")}</span>
          {(["absolute", "unit"] as const).map((mode) => {
            const active = sortMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setSortMode(mode)}
                aria-pressed={active}
                className={cn(
                  "rounded-pill px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors",
                  active
                    ? "bg-cesta-green text-white"
                    : "bg-surface text-muted hover:text-ink",
                )}
              >
                {mode === "absolute" ? t("sortAbsolute") : t("sortUnit")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Products list */}
      {products.isPending ? (
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : products.isError ? (
        <p className="py-6 text-center text-sm text-coral">
          Error al cargar productos.
        </p>
      ) : sortedItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {sortedItems.map((p) => (
            <ProductCard key={p.id} product={p} sortMode={sortMode} />
          ))}
        </div>
      ) : (
        <HomeEmptyState
          query={search || undefined}
          categoryLabel={
            category
              ? categories.data?.find((c) => c.slug === category)?.nameEs
              : undefined
          }
          onReset={() => {
            setSearch("");
            setCategory(undefined);
            setOnPromotion(false);
          }}
        />
      )}
    </main>
  );
}
