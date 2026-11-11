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
  const { data: basket, isLoading } = useLatestBasket(Boolean(user));

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm text-muted">Inicia sesión para ver tu cesta familiar.</p>
        <Button asChild size="sm">
          <Link href="/login">Entrar</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label="Volver">
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="flex-1 font-display text-lg font-bold text-ink">
          Mi Cesta familiar
        </h1>
        <Button asChild size="icon" variant="ghost" aria-label="Configurar">
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
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <h2 className="font-display text-xl font-bold text-ink">
        Aún no tienes cesta
      </h2>
      <p className="max-w-xs text-sm text-muted">
        Configura el perfil de tu familia y Cesta generará una cesta de compras
        mensual con costo estimado en cada supermercado.
      </p>
      <Button asChild className="mt-4">
        <Link href="/minha-cesta/configurar">Configurar perfil</Link>
      </Button>
    </div>
  );
}

function PendingState() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
      <p className="text-sm text-muted">Generando tu cesta…</p>
    </div>
  );
}

function FailedState({ message }: { message: string | null }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <p className="text-sm text-coral">
        {message ?? "Error al generar la cesta."}
      </p>
      <Button asChild size="sm">
        <Link href="/minha-cesta/configurar">Reintentar</Link>
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

  return (
    <>
      <section className="px-4 py-4">
        <div className="rounded-card bg-cesta-green p-4 text-white">
          <p className="text-xs opacity-80">Coste mensual estimado</p>
          <p className="font-display text-3xl font-extrabold">
            {formatPrice(basket.estimatedCost)}
          </p>
          <p className="mt-1 text-xs opacity-80">
            {basket.items.length}{" "}
            {basket.items.length === 1 ? "producto" : "productos"}
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
          Regenerar (mantiene fijados y obligatorios)
        </Button>
      </section>

      <section className="px-4 py-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Productos
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
              Obligatorio
            </span>
          )}
          {item.isLocked && (
            <span className="rounded-pill bg-violet/20 px-2 py-0.5 text-[10px] font-medium text-violet">
              Fijado
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
          aria-label="Disminuir"
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
          aria-label="Aumentar"
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
        aria-label={item.isLocked ? "Desfijar" : "Fijar"}
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
        aria-label={item.isRequired ? "Quitar obligatorio" : "Marcar obligatorio"}
      >
        <Pin
          className={cn("h-4 w-4", item.isRequired ? "text-amber" : "text-muted")}
        />
      </Button>

      <Button
        size="icon"
        variant="ghost"
        onClick={() => removeItem.mutate(item.id)}
        aria-label="Eliminar"
      >
        <Trash2 className="h-4 w-4 text-coral" />
      </Button>
    </div>
  );
}
