"use client";

import { Minus, Plus } from "lucide-react";

interface MemberCounterProps {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
}

export function MemberCounter({
  label,
  hint,
  value,
  onChange,
  min = 0,
}: MemberCounterProps) {
  return (
    <div className="flex items-center justify-between rounded-card bg-white p-3 shadow-card">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="h-9 w-9 rounded-btn bg-surface flex items-center justify-center hover:bg-border/40 cursor-pointer disabled:opacity-50"
          disabled={value <= min}
        >
          <Minus className="h-4 w-4 text-ink" />
        </button>
        <span className="w-8 text-center text-base font-bold text-ink">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="h-9 w-9 rounded-btn bg-cesta-green flex items-center justify-center hover:bg-cesta-green-light cursor-pointer"
        >
          <Plus className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  );
}
