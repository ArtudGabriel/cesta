"use client";

import { ArrowLeft, Heart, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  useFavorites,
  useRemoveFavorite,
} from "@/features/favorites/hooks/use-favorites";
import { useAuthStore } from "@/stores/auth.store";
import { formatPrice } from "@/lib/utils";

export default function FavoritosPage() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const router = useRouter();
  const { data, isLoading } = useFavorites();
  const remove = useRemoveFavorite();

  useEffect(() => {
    if (isHydrated && !user) {
      router.replace(
        `/login?returnUrl=${encodeURIComponent("/favoritos")}`,
      );
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

  return (
    <main className="pb-16">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label="Volver">
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="flex-1 font-display text-lg font-bold text-ink">
          Mis favoritos
        </h1>
        {favorites.length > 0 && (
          <span className="text-xs text-muted">{favorites.length}</span>
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
            {favorites.map((fav) => (
              <li
                key={fav.id}
                className="flex items-center gap-3 rounded-card bg-white p-3 shadow-sm"
              >
                <Link
                  href={`/produto/${fav.productId}`}
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
                      <p className="mt-1 text-sm font-semibold text-cesta-green">
                        {formatPrice(fav.cheapestPrice.price)}{" "}
                        <span className="text-xs font-normal text-muted">
                          en {fav.cheapestPrice.supermarketName}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted">
                        Sin precio disponible
                      </p>
                    )}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => remove.mutate(fav.productId)}
                  disabled={remove.isPending}
                  aria-label="Quitar de favoritos"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
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
