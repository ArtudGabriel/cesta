"use client";

import {
  ArrowLeft,
  Loader2,
  Lock,
  Minus,
  Pin,
  Plus,
  RefreshCw,
  Repeat,
  Trash2,
  Unlock,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BestMarketList } from "@/features/family-basket/components/best-market-list";
import { RegenerateConfirm } from "@/features/family-basket/components/regenerate-confirm";
import { ReplaceItemSheet } from "@/features/family-basket/components/replace-item-sheet";
import {
  useAddBasketItem,
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
      <header
        className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3"
        data-sentry-unmask
      >
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
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center" data-sentry-unmask>
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
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center" data-sentry-unmask>
      <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
      <p className="text-sm text-muted">{t("pending")}</p>
    </div>
  );
}

function FailedState({ message }: { message: string | null }) {
  const t = useTranslations("familyBasket");
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center" data-sentry-unmask>
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      {/* Sprint 98 GDPR: estimatedCost + item names/qtys = PII. Chrome (header,
          label "Total", config icon) unmasked. */}
      <section className="px-4 py-4" data-sentry-mask>
        <div className="rounded-card bg-cesta-green p-4 text-white">
          <p className="text-xs opacity-80" data-sentry-unmask>
            {t("costLabel")}
          </p>
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
          onClick={() => setConfirmOpen(true)}
          disabled={regenerate.isPending}
          data-sentry-unmask
        >
          <RefreshCw
            className={cn("h-4 w-4", regenerate.isPending && "animate-spin")}
          />
          {t("regenerate")}
        </Button>
      </section>

      <section className="px-4 py-4" data-sentry-mask>
        <h2
          className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted"
          data-sentry-unmask
        >
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

      <BestMarketList items={basket.items} />

      <RegenerateConfirm
        open={confirmOpen}
        loading={regenerate.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          regenerate.mutate();
          setConfirmOpen(false);
        }}
      />
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
  const addItem = useAddBasketItem(basketId);
  const t = useTranslations("familyBasket");
  const [replaceOpen, setReplaceOpen] = useState(false);

  async function handleReplace(newProductId: string) {
    const qty = item.quantity;
    await removeItem.mutateAsync(item.id);
    await addItem.mutateAsync({ productId: newProductId, quantity: qty });
  }

  return (
    <>
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
          <div className="mt-1 flex gap-1" data-sentry-unmask>
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
            data-sentry-unmask
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
            data-sentry-unmask
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
          data-sentry-unmask
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
          data-sentry-unmask
        >
          <Pin
            className={cn("h-4 w-4", item.isRequired ? "text-amber" : "text-muted")}
          />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => setReplaceOpen(true)}
          aria-label={t("replaceTitle")}
          data-sentry-unmask
        >
          <Repeat className="h-4 w-4 text-muted" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => removeItem.mutate(item.id)}
          aria-label={t("itemDelete")}
          data-sentry-unmask
        >
          <Trash2 className="h-4 w-4 text-coral" />
        </Button>
      </div>

      <ReplaceItemSheet
        open={replaceOpen}
        onClose={() => setReplaceOpen(false)}
        onPick={handleReplace}
        currentProductId={item.productId}
      />
    </>
  );
}
