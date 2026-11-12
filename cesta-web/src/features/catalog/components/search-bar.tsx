"use client";

import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isPending?: boolean;
  clearLabel?: string;
  className?: string;
  onFocus?: () => void;
  ariaExpanded?: boolean;
  ariaActivedescendant?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Buscar producto…",
  isPending = false,
  clearLabel = "Limpiar búsqueda",
  className,
  onFocus,
  ariaExpanded,
  ariaActivedescendant,
}: SearchBarProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className="pl-12 pr-16"
        role="combobox"
        aria-expanded={ariaExpanded}
        aria-autocomplete="list"
        aria-controls="search-suggestions-list"
        aria-activedescendant={ariaActivedescendant}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {isPending && (
          <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden />
        )}
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={clearLabel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
