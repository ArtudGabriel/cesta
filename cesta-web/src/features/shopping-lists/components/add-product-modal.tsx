"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProducts } from "@/features/catalog/hooks/use-catalog";
import { formatPrice } from "@/lib/utils";
import { useAddItem } from "../hooks/use-shopping-lists";

interface AddProductModalProps {
  listId: string;
  open: boolean;
  onClose: () => void;
}

export function AddProductModal({ listId, open, onClose }: AddProductModalProps) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useProducts({
    search: search || undefined,
    limit: 15,
  });
  const addItem = useAddItem(listId);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full max-h-[85vh] overflow-hidden rounded-t-card bg-white sm:max-w-md sm:rounded-card">
        <header className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-display text-lg font-bold text-ink">
            Agregar producto
          </h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="cursor-pointer rounded-btn p-1 hover:bg-surface"
          >
            <X className="h-5 w-5 text-ink" />
          </button>
        </header>

        <div className="p-4">
          <Input
            autoFocus
            placeholder="Buscar producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-4 pb-6">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-cesta-green" />
            </div>
          ) : (
            <ul className="space-y-2">
              {(data?.items ?? []).map((product) => (
                <li
                  key={product.id}
                  className="flex items-center gap-3 rounded-card border border-border p-2"
                >
                  <div className="h-10 w-10 flex-shrink-0 rounded-btn bg-surface" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-ink">
                      {product.name}
                    </p>
                    {product.cheapestPrice !== null && (
                      <p className="text-xs text-muted">
                        desde {formatPrice(product.cheapestPrice)}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      addItem.mutate(
                        { productId: product.id, quantity: 1 },
                        {
                          onSuccess: () => {
                            // mantém modal aberto pra adicionar múltiplos
                          },
                        },
                      );
                    }}
                    disabled={addItem.isPending}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
