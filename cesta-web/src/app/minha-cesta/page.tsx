"use client";

import {
  ArrowLeft,
  Loader2,
  Lock,
  Minus,
  Pin,
  Plus,
  RefreshCw,
  Trash2,
  Unlock,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  useLatestBasket,
  useRegenerateBasket,
  useRemoveBasketItem,
  useUpdateBasketItem,
} from "@/features/family-basket/hooks/use-family-basket";
import type { BasketItem } from "@/features/family-basket/types/family-basket.types";
import { cn, formatPrice } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

export default function MyBasketPage() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const router = useRouter();
  const { data: basket, isLoading } = useLatestBasket(Boolean(user));
  const t = useTranslations("familyBasket");
  const tNav = useTranslations("nav");

  useEffect(() => {
    if (isHydrated && !user) {
      router.replace(`/login?returnUrl=${encodeURIComponent("/minha-cesta")}`);
    }
  }, [isHydrated, user, router]);

  if (!isHydrated || !user) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label={tNav("back")}>
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="flex-1 font-display text-lg font-bold text-ink">
          {t("title")}
        </h1>
        <Button asChild size="icon" variant="ghost" aria-label={t("configure")}>
          <Link href="/minha-cesta/configurar">
            <UserCog className="h-5 w-5" />
          </Link>
        </Button>
      </header>

      {isLoading ? (
        <div className="flex flex-1 justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
        </div>
      ) : !basket ? (
        <EmptyState />
      ) : basket.status === "pending" ? (
        <PendingState />
      ) : basket.status === "failed" ? (
        <FailedState message={basket.errorMessage} />
      ) : (
        <ReadyBasket basket={basket} />
      )}
    </main>
  );
}

function EmptyState() {
  const t = useTranslations("familyBasket");
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <h2 className="font-display text-xl font-bold text-ink">
        {t("emptyTitle")}
      </h2>
      <p className="max-w-xs text-sm text-muted">{t("emptySubtitle")}</p>
      <Button asChild className="mt-4">
        <Link href="/minha-cesta/configurar">{t("emptyCta")}</Link>
      </Button>
    </div>
  );
}

function PendingState() {
  const t = useTranslations("familyBasket");
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
      <p className="text-sm text-muted">{t("pending")}</p>
    </div>
  );
}

function FailedState({ message }: { message: string | null }) {
  const t = useTranslations("familyBasket");
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <p className="text-sm text-coral">{message ?? t("failedDefault")}</p>
      <Button asChild size="sm">
        <Link href="/minha-cesta/configurar">{t("failedCta")}</Link>
      </Button>
    </div>
  );
}

function ReadyBasket({
  basket,
}: {
  basket: NonNullable<ReturnType<typeof useLatestBasket>["data"]>;
}) {
  const regenerate = useRegenerateBasket(basket.id);
  const t = useTranslations("familyBasket");

  return (
    <>
      <section className="px-4 py-4">
        <div className="rounded-card bg-cesta-green p-4 text-white">
          <p className="text-xs opacity-80">{t("costLabel")}</p>
          <p className="font-display text-3xl font-extrabold">
            {formatPrice(basket.estimatedCost)}
          </p>
          <p className="mt-1 text-xs opacity-80">
            {t("itemsCount", { count: basket.items.length })}
          </p>
        </div>

        <Button
          variant="secondary"
          className="mt-3 w-full"
          onClick={() => regenerate.mutate()}
          disabled={regenerate.isPending}
        >
          <RefreshCw
            className={cn("h-4 w-4", regenerate.isPending && "animate-spin")}
          />
          {t("regenerate")}
        </Button>
      </section>

      <section className="px-4 py-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("productsHeader")}
        </h2>
        <ul className="space-y-2">
          {basket.items.map((item) => (
            <li key={item.id}>
              <BasketItemRow basketId={basket.id} item={item} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function BasketItemRow({
  basketId,
  item,
}: {
  basketId: string;
  item: BasketItem;
}) {
  const updateItem = useUpdateBasketItem(basketId);
  const removeItem = useRemoveBasketItem(basketId);
  const t = useTranslations("familyBasket");

  return (
    <div className="flex items-center gap-3 rounded-card bg-white p-3 shadow-card">
      <div className="h-12 w-12 flex-shrink-0 rounded-btn bg-surface" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-ink">
          {item.product.name}
        </p>
        <p className="text-xs text-muted">
          {formatPrice(item.unitPrice)} · ={" "}
          <span className="font-medium text-cesta-green">
            {formatPrice(item.subtotal)}
          </span>
        </p>
        <div className="mt-1 flex gap-1">
          {item.isRequired && (
            <span className="rounded-pill bg-amber/20 px-2 py-0.5 text-[10px] font-medium text-amber">
              {t("itemRequired")}
            </span>
          )}
          {item.isLocked && (
            <span className="rounded-pill bg-violet/20 px-2 py-0.5 text-[10px] font-medium text-violet">
              {t("itemLocked")}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() =>
            updateItem.mutate({
              itemId: item.id,
              payload: { quantity: Math.max(0.001, item.quantity - 1) },
            })
          }
          className="h-8 w-8 rounded-btn bg-surface flex items-center justify-center cursor-pointer hover:bg-border/40"
          aria-label={t("itemDecrease")}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-6 text-center text-sm font-semibold">
          {item.quantity}
        </span>
        <button
          onClick={() =>
            updateItem.mutate({
              itemId: item.id,
              payload: { quantity: item.quantity + 1 },
            })
          }
          className="h-8 w-8 rounded-btn bg-surface flex items-center justify-center cursor-pointer hover:bg-border/40"
          aria-label={t("itemIncrease")}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <Button
        size="icon"
        variant="ghost"
        onClick={() =>
          updateItem.mutate({
            itemId: item.id,
            payload: { isLocked: !item.isLocked },
          })
        }
        aria-label={item.isLocked ? t("itemUnlock") : t("itemLock")}
      >
        {item.isLocked ? (
          <Lock className="h-4 w-4 text-violet" />
        ) : (
          <Unlock className="h-4 w-4 text-muted" />
        )}
      </Button>

      <Button
        size="icon"
        variant="ghost"
        onClick={() =>
          updateItem.mutate({
            itemId: item.id,
            payload: { isRequired: !item.isRequired },
          })
        }
        aria-label={item.isRequired ? t("itemUnmarkRequired") : t("itemMarkRequired")}
      >
        <Pin
          className={cn("h-4 w-4", item.isRequired ? "text-amber" : "text-muted")}
        />
      </Button>

      <Button
        size="icon"
        variant="ghost"
        onClick={() => removeItem.mutate(item.id)}
        aria-label={t("itemDelete")}
      >
        <Trash2 className="h-4 w-4 text-coral" />
      </Button>
    </div>
  );
}
