"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
  className?: string;
}

const SIZE = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-7 w-7" };

export function StarRating({
  value,
  onChange,
  size = "md",
  readOnly = false,
  className,
}: StarRatingProps) {
  const isInteractive = Boolean(onChange) && !readOnly;
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className={cn("inline-flex items-center gap-1", className)} role={isInteractive ? "radiogroup" : "img"} aria-label={`Rating ${value} of 5`}>
      {stars.map((n) => {
        const filled = n <= Math.round(value);
        const Icon = Star;
        if (!isInteractive) {
          return (
            <Icon
              key={n}
              className={cn(
                SIZE[size],
                filled ? "text-amber fill-amber" : "text-border",
              )}
            />
          );
        }
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n)}
            aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
            className="cursor-pointer rounded-btn p-1 hover:bg-surface"
          >
            <Icon
              className={cn(
                SIZE[size],
                filled ? "text-amber fill-amber" : "text-border",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
