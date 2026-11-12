"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HomeEmptyStateProps {
  query?: string;
  categoryLabel?: string;
  onReset: () => void;
}

export function HomeEmptyState({
  query,
  categoryLabel,
  onReset,
}: HomeEmptyStateProps) {
  const title = query
    ? "No encontramos productos"
    : categoryLabel
      ? `Sin productos en ${categoryLabel}`
      : "Sin productos";

  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-white px-6 py-10 text-center shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cesta-green/10">
        <Search className="h-8 w-8 text-cesta-green opacity-60" />
      </div>
      <p className="font-display text-base font-bold text-ink">{title}</p>
      <p className="max-w-xs text-sm text-muted">
        Prueba con otra palabra o explora otras categorías.
      </p>
      <Button type="button" size="sm" onClick={onReset}>
        Ver todas las categorías
      </Button>
    </div>
  );
}
