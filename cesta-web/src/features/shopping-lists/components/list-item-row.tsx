"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";
import type { ShoppingListItem } from "../types/shopping-list.types";
import { useRemoveItem, useUpdateItem } from "../hooks/use-shopping-lists";

interface ListItemRowProps {
  listId: string;
  item: ShoppingListItem;
}

export function ListItemRow({ listId, item }: ListItemRowProps) {
  const [qty, setQty] = useState(item.quantity);
  const updateItem = useUpdateItem(listId);
  const removeItem = useRemoveItem(listId);

  const cheapest = item.product.prices.find(
    (p) => p.supermarketSlug === item.product.cheapestSupermarketSlug,
  );
  const subtotal = cheapest ? cheapest.price * qty : null;

  function commit(next: number) {
    const rounded = Math.round(next * 1000) / 1000;
    if (rounded <= 0) return;
    setQty(rounded);
    updateItem.mutate({ itemId: item.id, quantity: rounded });
  }

  return (
    <div className="flex items-center gap-3 rounded-card bg-white p-3 shadow-card">
      <div className="h-12 w-12 flex-shrink-0 rounded-btn bg-surface" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-ink">
          {item.product.name}
        </p>
        {item.product.brand && (
          <p className="text-xs text-muted">{item.product.brand}</p>
        )}
        {cheapest && subtotal !== null && (
          <p className="mt-1 text-xs">
            <span className="text-muted">
              {formatPrice(cheapest.price)} ·{" "}
            </span>
            <span className="font-medium text-cesta-green">
              = {formatPrice(subtotal)}
            </span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => commit(qty - 1)}
          className={cn(
            "h-8 w-8 rounded-btn bg-surface flex items-center justify-center cursor-pointer",
            "hover:bg-border/40 active:scale-95",
          )}
          aria-label="Disminuir cantidad"
        >
          <Minus className="h-4 w-4 text-ink" />
        </button>
        <span className="w-8 text-center text-sm font-semibold text-ink">
          {qty}
        </span>
        <button
          onClick={() => commit(qty + 1)}
          className={cn(
            "h-8 w-8 rounded-btn bg-surface flex items-center justify-center cursor-pointer",
            "hover:bg-border/40 active:scale-95",
          )}
          aria-label="Aumentar cantidad"
        >
          <Plus className="h-4 w-4 text-ink" />
        </button>
      </div>

      <Button
        size="icon"
        variant="ghost"
        onClick={() => removeItem.mutate(item.id)}
        disabled={removeItem.isPending}
        aria-label="Eliminar"
      >
        <Trash2 className="h-4 w-4 text-coral" />
      </Button>
    </div>
  );
}
