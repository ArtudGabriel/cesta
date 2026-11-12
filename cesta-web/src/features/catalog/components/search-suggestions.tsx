"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, ImageOff, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice, cn } from "@/lib/utils";
import { useRecentSearches } from "../hooks/use-recent-searches";
import { useSuggestions } from "../hooks/use-suggestions";
import { HighlightedText } from "./highlighted-text";

interface SearchSuggestionsProps {
  query: string;
  onSelect?: () => void;
  onSelectRecent: (q: string) => void;
  onClose: () => void;
}

type Item =
  | { kind: "recent"; value: string }
  | {
      kind: "suggestion";
      id: string;
      name: string;
      brand: string | null;
      imageUrl: string | null;
      cheapestPriceValue: number | null;
    };

export function SearchSuggestions({
  query,
  onSelect,
  onSelectRecent,
  onClose,
}: SearchSuggestionsProps) {
  const t = useTranslations("home.suggestions");
  const router = useRouter();
  const { data, isPending, isFetching } = useSuggestions(query, 8);
  const { recents, add, remove, clear } = useRecentSearches();
  const showingRecents = query.trim().length < 2;

  const items: Item[] = useMemo(() => {
    if (showingRecents) {
      return recents.slice(0, 5).map((v) => ({ kind: "recent" as const, value: v }));
    }
    if (!data) return [];
    return data.map((s) => ({
      kind: "suggestion" as const,
      id: s.id,
      name: s.name,
      brand: s.brand,
      imageUrl: s.imageUrl,
      cheapestPriceValue: s.cheapestPrice?.value ?? null,
    }));
  }, [showingRecents, recents, data]);

  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query, items.length]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (items.length === 0 && e.key !== "Escape") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === "Enter") {
        if (activeIndex < 0) return;
        const item = items[activeIndex];
        if (!item) return;
        e.preventDefault();
        if (item.kind === "recent") {
          onSelectRecent(item.value);
        } else {
          add(query);
          onSelect?.();
          router.push(`/produto/${item.id}`);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [items, activeIndex, add, onClose, onSelect, onSelectRecent, query, router]);

  useEffect(() => {
    if (activeIndex < 0 || !containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-suggestion-index="${activeIndex}"]`,
    );
    if (el) (el as HTMLElement).scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (showingRecents && recents.length === 0) return null;

  return (
    <div
      ref={containerRef}
      role="listbox"
      className="absolute inset-x-0 top-full z-[60] mt-2 max-h-96 overflow-y-auto rounded-xl bg-white shadow-card-elevated border border-border/40"
    >
      {!showingRecents && (isPending || isFetching) ? (
        <ul className="divide-y divide-border/40">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3" aria-hidden>
              <div className="h-10 w-10 flex-shrink-0 rounded-md bg-surface animate-pulse" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-surface animate-pulse" />
                <div className="h-2 w-1/3 rounded bg-surface animate-pulse" />
              </div>
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">
          {t("empty", { query })}
        </p>
      ) : (
        <>
          {showingRecents && (
            <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {t("recentsTitle")}
            </p>
          )}
          <ul className="divide-y divide-border/40">
            {items.map((item, idx) => {
              const isActive = idx === activeIndex;
              const id = `suggestion-${idx}`;
              if (item.kind === "recent") {
                return (
                  <li key={`recent-${item.value}`}>
                    <div
                      id={id}
                      data-suggestion-index={idx}
                      role="option"
                      aria-selected={isActive}
                      className={cn(
                        "flex min-h-11 items-center gap-3 px-4 py-2",
                        isActive && "bg-neutral-100",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectRecent(item.value)}
                        className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer text-left"
                      >
                        <Clock className="h-4 w-4 flex-shrink-0 text-muted" aria-hidden />
                        <span className="truncate text-sm text-ink">{item.value}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item.value)}
                        aria-label={t("removeRecent")}
                        className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              }
              return (
                <li key={item.id}>
                  <Link
                    href={`/produto/${item.id}`}
                    onClick={() => {
                      add(query);
                      onSelect?.();
                    }}
                    id={id}
                    data-suggestion-index={idx}
                    role="option"
                    aria-selected={isActive}
                    className={cn(
                      "flex min-h-11 items-center gap-3 px-4 py-2 cursor-pointer",
                      isActive ? "bg-neutral-100" : "hover:bg-surface",
                    )}
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-surface text-muted">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-full w-full rounded-md object-cover"
                        />
                      ) : (
                        <ImageOff className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        <HighlightedText text={item.name} highlight={query} />
                      </p>
                      {item.brand && (
                        <p className="truncate text-xs text-muted">{item.brand}</p>
                      )}
                    </div>
                    {item.cheapestPriceValue !== null && (
                      <span className="text-sm font-semibold text-cesta-green whitespace-nowrap">
                        {formatPrice(item.cheapestPriceValue)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          {showingRecents && recents.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="block w-full px-4 py-2 text-left text-xs font-medium text-coral hover:bg-surface cursor-pointer"
            >
              {t("clearAll")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
