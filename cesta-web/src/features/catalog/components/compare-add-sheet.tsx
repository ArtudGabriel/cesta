"use client";

import { Search, X } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useProducts } from "../hooks/use-catalog";
import { cn } from "@/lib/utils";

interface CompareAddSheetProps {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  onAdd: (productId: string) => void;
  max?: number;
}

export function CompareAddSheet({
  open,
  onClose,
  selectedIds,
  onAdd,
  max = 4,
}: CompareAddSheetProps) {
  const [q, setQ] = useState("");
  const atMax = selectedIds.length >= max;
  const results = useProducts({ search: q || undefined, limit: 20 });

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      role="presentation"
      className="fixed inset-0 z-50 flex items-end bg-black/40 md:items-center md:justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl bg-cream p-4 md:max-w-lg md:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">
            Agregar producto
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {atMax && (
          <p className="mb-3 rounded-md bg-amber/10 px-3 py-2 text-xs text-amber">
            Máximo {max} productos. Quita alguno para agregar otro.
          </p>
        )}

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar producto…"
            className="pl-9"
          />
        </div>

        <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
          {results.isPending ? (
            Array.from({ length: 4 }).map((_, i) => (
              <li
                key={i}
                className="h-16 animate-pulse rounded-card bg-neutral-200"
              />
            ))
          ) : (results.data?.items ?? []).length === 0 ? (
            <li className="py-6 text-center text-sm text-muted">
              Sin resultados.
            </li>
          ) : (
            (results.data?.items ?? []).map((p) => {
              const already = selectedIds.includes(p.id);
              const disabled = already || atMax;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onAdd(p.id);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-card bg-white p-3 text-left shadow-sm transition-opacity cursor-pointer",
                      disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <div className="h-12 w-12 flex-shrink-0 rounded-md bg-surface" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {p.name}
                      </p>
                      {p.brand && (
                        <p className="truncate text-xs text-muted">{p.brand}</p>
                      )}
                    </div>
                    {already && (
                      <span className="text-xs font-medium text-muted">
                        Ya agregado
                      </span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
