"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  productsService,
  type ProductSearchItem,
} from "@/features/products/services/products.service";
import { cn } from "@/lib/utils";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

interface Props {
  value: ProductSearchItem[];
  onChange: (next: ProductSearchItem[]) => void;
  max?: number;
  "data-testid"?: string;
}

export function ProductPicker({
  value,
  onChange,
  max = 20,
  "data-testid": testId,
}: Props) {
  const t = useTranslations("components.productPicker");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const selectedIds = useMemo(() => new Set(value.map((p) => p.id)), [value]);

  // Debounce + fetch. requestId cancels out-of-order responses.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_CHARS) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const current = ++requestId.current;
    const handle = setTimeout(() => {
      productsService
        .search(trimmed, 10)
        .then((res) => {
          if (requestId.current !== current) return;
          setResults(res.items);
          setHighlight(0);
        })
        .catch(() => {
          if (requestId.current !== current) return;
          setResults([]);
        })
        .finally(() => {
          if (requestId.current !== current) return;
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const pick = useCallback(
    (item: ProductSearchItem) => {
      if (selectedIds.has(item.id)) return;
      if (value.length >= max) return;
      onChange([...value, item]);
      setQuery("");
      setResults([]);
      inputRef.current?.focus();
    },
    [max, onChange, selectedIds, value],
  );

  const remove = useCallback(
    (id: string) => {
      onChange(value.filter((p) => p.id !== id));
    },
    [onChange, value],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (results[highlight]) {
        e.preventDefault();
        pick(results[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && value.length > 0) {
      remove(value[value.length - 1].id);
    }
  }

  const trimmed = query.trim();
  const showDropdown =
    open && trimmed.length >= MIN_CHARS && !loading && results.length === 0;
  const showResults =
    open && results.length > 0 && !loading;

  const priceFmt = useMemo(
    () => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }),
    [],
  );

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col gap-2"
      data-testid={testId ?? "product-picker"}
      data-sentry-mask
    >
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" data-testid="product-picker-chips">
          {value.map((p) => (
            <li
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full bg-cesta-green/10 py-1 pl-3 pr-1 text-sm text-cesta-green"
            >
              <span>{p.name}</span>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="rounded-full p-0.5 hover:bg-cesta-green/20"
                aria-label={t("removeAria", { name: p.name })}
                data-testid={`product-picker-chip-remove-${p.id}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("placeholder")}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showResults}
          data-testid="product-picker-input"
          disabled={value.length >= max}
        />
        {loading && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted"
            aria-hidden
            data-testid="product-picker-loading"
          />
        )}
      </div>

      {showResults && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-auto rounded-btn border border-border bg-white shadow-lg"
          data-testid="product-picker-results"
        >
          {results.map((item, idx) => {
            const disabled = selectedIds.has(item.id);
            return (
              <li
                key={item.id}
                role="option"
                aria-selected={idx === highlight}
                aria-disabled={disabled}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm",
                  idx === highlight && !disabled && "bg-cesta-green/10",
                  disabled && "cursor-not-allowed opacity-50",
                )}
                onMouseEnter={() => setHighlight(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!disabled) pick(item);
                }}
                data-testid={`product-picker-result-${item.id}`}
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <div
                    className="h-8 w-8 rounded bg-muted/30"
                    aria-hidden
                  />
                )}
                <span className="flex-1 truncate">{item.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {item.cheapestUnitPrice != null
                    ? priceFmt.format(item.cheapestUnitPrice)
                    : t("noPrice")}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-full z-10 mt-1 rounded-btn border border-border bg-white px-3 py-2 text-sm text-muted shadow-lg"
          data-testid="product-picker-no-results"
        >
          {t("noResults")}
        </div>
      )}
    </div>
  );
}
