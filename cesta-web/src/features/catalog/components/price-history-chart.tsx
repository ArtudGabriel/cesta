"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn, formatPrice } from "@/lib/utils";
import { usePriceHistory } from "../hooks/use-price-history";
import type { PriceHistorySeries } from "../services/price-history.service";

type Range = 30 | 60 | 90;

interface PriceHistoryChartProps {
  productId: string;
  supermarketId?: string;
  className?: string;
}

interface ChartRow {
  date: string;
  dateLabel: string;
  [supermarketSlug: string]: string | number | undefined;
}

const DEFAULT_COLOR = "#1b6b48";

export function PriceHistoryChart({
  productId,
  supermarketId,
  className,
}: PriceHistoryChartProps) {
  const [range, setRange] = useState<Range>(30);
  const { data, isLoading, isError } = usePriceHistory(productId, {
    supermarketId,
    days: range,
  });

  const { rows, series } = useMemo(() => buildRows(data ?? []), [data]);

  return (
    <div className={cn("rounded-card bg-white p-4 shadow-card", className)}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-bold text-ink">
          Histórico de precios
        </h3>
        <div className="flex gap-1 rounded-pill bg-surface p-1">
          {([30, 60, 90] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-pill px-3 py-1 text-xs font-medium cursor-pointer transition-colors",
                range === r
                  ? "bg-cesta-green text-white"
                  : "text-muted hover:text-ink",
              )}
            >
              {r}d
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-cesta-green" />
        </div>
      ) : isError ? (
        <p className="py-10 text-center text-sm text-coral">
          Error al cargar el histórico.
        </p>
      ) : rows.length < 2 ? (
        <p className="py-10 text-center text-sm text-muted">
          Sin histórico suficiente todavía.
        </p>
      ) : (
        <div className="h-40 w-full md:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0edea" vertical={false} />
              <XAxis
                dataKey="dateLabel"
                tick={{ fill: "#6B6560", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: "#6B6560", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v) => `€${Number(v).toFixed(2)}`}
              />
              <Tooltip content={<CustomTooltip series={series} />} />
              {series.map((s) => (
                <Line
                  key={s.slug}
                  type="monotone"
                  dataKey={s.slug}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: s.color }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {series.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          {series.map((s) => (
            <li key={s.slug} className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-pill"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface SeriesMeta {
  slug: string;
  name: string;
  color: string;
}

function buildRows(data: PriceHistorySeries[] | undefined): {
  rows: ChartRow[];
  series: SeriesMeta[];
} {
  const series: SeriesMeta[] = (data ?? []).map((s) => ({
    slug: s.supermarketSlug,
    name: s.supermarketName,
    color: s.supermarketColor ?? DEFAULT_COLOR,
  }));

  const byDate = new Map<string, ChartRow>();

  for (const serie of data ?? []) {
    for (const point of serie.points) {
      const d = new Date(point.date);
      const key = d.toISOString().slice(0, 10);
      const existing =
        byDate.get(key) ??
        ({
          date: key,
          dateLabel: d.toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
          }),
        } as ChartRow);
      existing[serie.supermarketSlug] = point.price;
      byDate.set(key, existing);
    }
  }

  const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { rows, series };
}

interface TooltipPayloadItem {
  value?: number | string | null;
  dataKey?: string | number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  series: SeriesMeta[];
}

function CustomTooltip({
  active,
  payload,
  label,
  series,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p) => p.value != null);
  if (rows.length === 0) return null;
  return (
    <div className="rounded-btn border border-border bg-white p-2 text-xs shadow-card">
      <p className="mb-1 font-semibold text-ink">{label}</p>
      <ul className="space-y-0.5">
        {rows.map((p) => {
          const meta = series.find((s) => s.slug === p.dataKey);
          return (
            <li key={String(p.dataKey)} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-pill"
                style={{ backgroundColor: meta?.color ?? DEFAULT_COLOR }}
              />
              <span className="text-muted">{meta?.name ?? p.dataKey}</span>
              <span className="ml-auto font-semibold text-ink">
                {formatPrice(Number(p.value))}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
