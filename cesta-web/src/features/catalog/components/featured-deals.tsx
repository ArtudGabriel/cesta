"use client";

import { Flame } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { cn, formatPrice } from "@/lib/utils";
import { useFeaturedDeals } from "../hooks/use-featured-deals";
import type { Product } from "../types/catalog.types";

interface FeaturedDealsProps {
  limit?: number;
}

interface DealEntry {
  product: Product;
  lowPrice: number;
  highPrice: number;
  cheapestSupermarketName: string;
  spread: number;
  savingsPercent: number;
}

/**
 * Sprint 132: seção home com top N produtos ordenados por maior gap de preço
 * entre supermarkets. Mostra preço baixo + supermarket + economia vs maior
 * preço. Driver principal pra engajamento multi-supermarket (DIA 2.15€ vs
 * Mercadona 4.50€ = 52% off).
 */
export function FeaturedDeals({ limit = 10 }: FeaturedDealsProps) {
  const t = useTranslations("home.featured");
  const { data, isPending } = useFeaturedDeals(limit);

  const deals = useMemo<DealEntry[]>(() => {
    if (!data) return [];
    return data
      .map((p) => {
        const available = p.prices.filter((pr) => pr.isAvailable);
        if (available.length < 2) return null;
        const prices = available.map((pr) => pr.price);
        const lowPrice = Math.min(...prices);
        const highPrice = Math.max(...prices);
        const cheapest = available.reduce((a, b) =>
          a.price < b.price ? a : b,
        );
        const spread = highPrice - lowPrice;
        const savingsPercent = highPrice > 0 ? (spread / highPrice) * 100 : 0;
        return {
          product: p,
          lowPrice,
          highPrice,
          cheapestSupermarketName: cheapest.supermarketName,
          spread,
          savingsPercent,
        };
      })
      .filter((e): e is DealEntry => e !== null);
  }, [data]);

  if (isPending) {
    return (
      <section className="mb-6" data-testid="featured-deals-section">
        <SectionHeader />
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-3 pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-40 w-40 flex-shrink-0 animate-pulse rounded-card bg-surface"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (deals.length === 0) return null;

  return (
    <section
      className="mb-6"
      data-testid="featured-deals-section"
      aria-label={t("title")}
    >
      <SectionHeader />
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-3 pb-2">
          {deals.map((deal) => (
            <DealCard key={deal.product.id} deal={deal} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeader() {
  const t = useTranslations("home.featured");
  return (
    <header className="mb-3 flex items-center gap-2">
      <Flame className="h-5 w-5 text-cesta-green" />
      <h2 className="font-display text-base font-bold text-ink">
        {t("title")}
      </h2>
      <span className="text-xs text-muted">{t("subtitle")}</span>
    </header>
  );
}

function DealCard({ deal }: { deal: DealEntry }) {
  const t = useTranslations("home.featured");
  return (
    <Link
      href={`/produto/${deal.product.id}`}
      className={cn(
        "flex w-44 flex-shrink-0 flex-col gap-2 rounded-card border border-border bg-white p-3 shadow-sm",
        "transition-shadow hover:shadow-md focus-visible:shadow-md",
      )}
      data-testid={`featured-deal-${deal.product.id}`}
    >
      <div className="relative aspect-square overflow-hidden rounded-btn bg-neutral-50">
        {deal.product.imageUrl ? (
          <Image
            src={deal.product.imageUrl}
            alt={deal.product.name}
            fill
            sizes="176px"
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-neutral-100" />
        )}
        <span
          className="absolute left-1 top-1 rounded-pill bg-cesta-green px-2 py-0.5 text-[10px] font-bold text-white"
          data-testid="featured-deal-savings"
        >
          -{deal.savingsPercent.toFixed(0)}%
        </span>
      </div>
      <p className="line-clamp-2 min-h-[2.4em] text-xs font-medium text-ink">
        {deal.product.name}
      </p>
      <div className="flex items-baseline gap-1">
        <span className="font-display text-base font-bold text-cesta-green">
          {formatPrice(deal.lowPrice)}
        </span>
        <span className="text-[10px] text-muted line-through">
          {formatPrice(deal.highPrice)}
        </span>
      </div>
      <p className="text-[10px] text-muted">
        {t("cheaperAt", { market: deal.cheapestSupermarketName })}
      </p>
    </Link>
  );
}
