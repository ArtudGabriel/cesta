"use client";

import { ArrowLeft, Check, Heart, Loader2, Scale, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useFavorites,
  useRemoveFavorite,
} from "@/features/favorites/hooks/use-favorites";
import { useAuthStore } from "@/stores/auth.store";
import { cn, formatPrice } from "@/lib/utils";
import { formatUnitPrice } from "@/features/catalog/utils/format-unit-price";
import { useLocale } from "@/features/catalog/hooks/use-locale";

const COMPARE_MAX = 4;

export default function FavoritosPage() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const router = useRouter();
  const { data, isLoading } = useFavorites();
  const remove = useRemoveFavorite();
  const locale = useLocale();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (isHydrated && !user) {
      router.replace(`/login?returnUrl=${encodeURIComponent("/favoritos")}`);
    }
  }, [isHydrated, user, router]);

  if (!isHydrated || !user) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
      </main>
    );
  }

  const favorites = data ?? [];

  function toggleSelect(productId: string) {
    setSelected((prev) => {
      if (prev.includes(productId)) return prev.filter((id) => id !== productId);
      if (prev.length >= COMPARE_MAX) return prev;
      return [...prev, productId];
    });
  }

  function goCompare() {
    if (selected.length < 2) return;
    router.push(`/comparar?products=${selected.join(",")}`);
  }

  function cancelSelect() {
    setSelectMode(false);
    setSelected([]);
  }

  return (
    <main className="pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label="Volver">
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="flex-1 font-display text-lg font-bold text-ink">
          Mis favoritos
        </h1>
        {favorites.length > 0 && !selectMode && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectMode(true)}
          >
            <Scale className="h-4 w-4" />
            Comparar
          </Button>
        )}
        {selectMode && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cancelSelect}
          >
            Cancelar
          </Button>
        )}
      </header>

      <section className="px-4 pt-2">
        {isLoading ? (
          <ul className="space-y-3">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-24 animate-pulse rounded-card bg-surface"
              />
            ))}
          </ul>
        ) : favorites.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3">
            {favorites.map((fav) => {
              const isSelected = selected.includes(fav.productId);
              return (
                <li
                  key={fav.id}
                  className={cn(
                    "flex items-center gap-3 rounded-card bg-white p-3 shadow-sm transition-all",
                    selectMode && isSelected && "ring-2 ring-cesta-green",
                  )}
                >
                  {selectMode && (
                    <button
                      type="button"
                      onClick={() => toggleSelect(fav.productId)}
                      aria-label={isSelected ? "Deseleccionar" : "Seleccionar"}
                      aria-pressed={isSelected}
                      className={cn(
                        "inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 cursor-pointer",
                        isSelected
                          ? "border-cesta-green bg-cesta-green text-white"
                          : "border-neutral-300 text-transparent",
                      )}
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  )}
                  <Link
                    href={
                      selectMode ? "#" : `/produto/${fav.productId}`
                    }
                    onClick={(e) => {
                      if (selectMode) {
                        e.preventDefault();
                        toggleSelect(fav.productId);
                      }
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md bg-surface text-muted">
                      {fav.product?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={fav.product.imageUrl}
                          alt=""
                          className="h-full w-full rounded-md object-cover"
                        />
                      ) : (
                        <Heart className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {fav.product?.name ?? "Produto"}
                      </p>
                      {fav.product?.brand && (
                        <p className="truncate text-xs text-muted">
                          {fav.product.brand}
                        </p>
                      )}
                      {fav.cheapestPrice ? (
                        <>
                          <p className="mt-1 text-sm font-semibold text-cesta-green">
                            {formatPrice(fav.cheapestPrice.price)}{" "}
                            <span className="text-xs font-normal text-muted">
                              en {fav.cheapestPrice.supermarketName}
                            </span>
                          </p>
                          {fav.cheapestPrice.unitPrice && (
                            <p className="text-xs text-muted">
                              {formatUnitPrice(fav.cheapestPrice.unitPrice, locale)}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="mt-1 text-xs text-muted">
                          Sin precio disponible
                        </p>
                      )}
                    </div>
                  </Link>
                  {!selectMode && (
                    <button
                      type="button"
                      onClick={() => remove.mutate(fav.productId)}
                      disabled={remove.isPending}
                      aria-label="Quitar de favoritos"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selectMode && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white p-4 shadow-lg">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <span className="text-sm text-muted">
              {selected.length}/{COMPARE_MAX} seleccionados
            </span>
            <Button
              type="button"
              className="flex-1"
              onClick={goCompare}
              disabled={selected.length < 2}
            >
              <Scale className="h-4 w-4" />
              Comparar {selected.length > 0 && `(${selected.length})`}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-white px-6 py-10 text-center shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
        <Heart className="h-8 w-8 text-muted" />
      </div>
      <p className="font-display text-base font-bold text-ink">
        Aún no tienes favoritos
      </p>
      <p className="max-w-xs text-sm text-muted">
        Toca ♥ en cualquier producto para guardarlo aquí y comparar sus precios
        después.
      </p>
      <Button asChild size="sm">
        <Link href="/">Explorar productos</Link>
      </Button>
    </div>
  );
}
