"use client";

import Link from "next/link";
import { ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/utils";
import { useSuggestions } from "../hooks/use-suggestions";
import { HighlightedText } from "./highlighted-text";

interface SearchSuggestionsProps {
  query: string;
  onSelect?: () => void;
}

export function SearchSuggestions({ query, onSelect }: SearchSuggestionsProps) {
  const t = useTranslations("home.suggestions");
  const { data, isPending, isFetching } = useSuggestions(query, 8);

  if (query.trim().length < 2) return null;

  return (
    <div
      role="listbox"
      aria-label={t("loading")}
      className="absolute inset-x-0 top-full z-[60] mt-2 max-h-96 overflow-y-auto rounded-xl bg-white shadow-card-elevated border border-border/40"
    >
      {isPending || isFetching ? (
        <ul className="divide-y divide-border/40">
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className="flex items-center gap-3 px-4 py-3"
              aria-hidden
            >
              <div className="h-10 w-10 flex-shrink-0 rounded-md bg-surface animate-pulse" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-surface animate-pulse" />
                <div className="h-2 w-1/3 rounded bg-surface animate-pulse" />
              </div>
            </li>
          ))}
        </ul>
      ) : !data || data.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">
          {t("empty", { query })}
        </p>
      ) : (
        <ul className="divide-y divide-border/40">
          {data.map((s) => (
            <li key={s.id}>
              <Link
                href={`/produto/${s.id}`}
                onClick={onSelect}
                className="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-surface cursor-pointer"
                role="option"
                aria-selected={false}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-surface text-muted">
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.imageUrl}
                      alt=""
                      className="h-full w-full rounded-md object-cover"
                    />
                  ) : (
                    <ImageOff className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    <HighlightedText text={s.name} highlight={query} />
                  </p>
                  {s.brand && (
                    <p className="truncate text-xs text-muted">{s.brand}</p>
                  )}
                </div>
                {s.cheapestPrice && (
                  <span className="text-sm font-semibold text-cesta-green whitespace-nowrap">
                    {formatPrice(s.cheapestPrice.value)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
