"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CreateAlertButton } from "@/features/alerts/components/create-alert-button";
import { DietaryBadges } from "@/features/catalog/components/dietary-badges";
import { NutritionTable } from "@/features/catalog/components/nutrition-table";
import { PriceComparisonGrid } from "@/features/catalog/components/price-comparison-grid";
import { PriceHistoryChart } from "@/features/catalog/components/price-history-chart";
import { useProduct, useSupermarkets } from "@/features/catalog/hooks/use-catalog";
import { useLocale } from "@/features/catalog/hooks/use-locale";
import { formatUnitPrice } from "@/features/catalog/utils/format-unit-price";
import { FavoriteToggle } from "@/features/favorites/components/favorite-toggle";
import { ReviewsSection } from "@/features/reviews/components/reviews-section";
import { formatPrice } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

export default function ProductDetailPage() {
  const params = useParams<{ pid: string }>();
  const { data: product, isLoading, isError } = useProduct(params.pid);
  const supermarkets = useSupermarkets();
  const user = useAuthStore((s) => s.user);
  const locale = useLocale();
  const t = useTranslations("product");
  const tNav = useTranslations("nav");

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
      </main>
    );
  }

  if (isError || !product) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-coral">{t("notFound")}</p>
        <Button asChild variant="secondary" size="sm">
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-16">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button
          asChild
          size="icon"
          variant="ghost"
          aria-label={tNav("back")}
        >
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="line-clamp-1 flex-1 font-display text-lg font-bold text-ink">
          {product.name}
        </h1>
        <FavoriteToggle productId={product.id} returnUrl={`/produto/${product.id}`} />
      </header>

      <div className="px-4 pb-4">
        <div className="h-48 w-full rounded-card bg-surface" />

        <div className="mt-4">
          <h2 className="font-display text-xl font-bold text-ink">
            {product.name}
          </h2>
          {product.brand && (
            <p className="mt-1 text-sm text-muted">{product.brand}</p>
          )}

          {product.cheapestPrice !== null && (
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-muted">{t("fromPrice")}</span>
                <span className="text-2xl font-extrabold text-cesta-green">
                  {formatPrice(product.cheapestPrice)}
                </span>
              </div>
              {product.cheapestUnitPrice && (
                <p className="mt-1 text-sm text-muted">
                  {formatUnitPrice(product.cheapestUnitPrice, locale)}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-4">
          <DietaryBadges product={product} />
        </div>
      </div>

      <section className="px-4 py-4">
        <h3 className="mb-3 font-display text-lg font-bold text-ink">
          {t("pricesHeader")}
        </h3>
        <PriceComparisonGrid prices={product.prices} />
      </section>

      {user && (
        <section className="px-4 py-2">
          <CreateAlertButton
            productId={product.id}
            supermarkets={supermarkets.data}
          />
        </section>
      )}

      <section className="px-4 py-4">
        <PriceHistoryChart productId={product.id} />
      </section>

      <section className="px-4 py-4">
        <h3 className="mb-3 font-display text-lg font-bold text-ink">
          {t("reviewsHeader")}
        </h3>
        <ReviewsSection productId={product.id} />
      </section>

      <section className="px-4 py-4">
        <h3 className="mb-3 font-display text-lg font-bold text-ink">
          {t("nutritionHeader")}
        </h3>
        <NutritionTable product={product} />
      </section>
    </main>
  );
}
