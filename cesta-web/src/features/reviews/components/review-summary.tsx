"use client";

import { StarRating } from "./star-rating";
import type { ReviewSummary as Summary } from "../types/review.types";

interface ReviewSummaryProps {
  summary: Summary;
}

export function ReviewSummary({ summary }: ReviewSummaryProps) {
  const rows: Array<[1 | 2 | 3 | 4 | 5, number]> = [
    [5, summary.distribution[5]],
    [4, summary.distribution[4]],
    [3, summary.distribution[3]],
    [2, summary.distribution[2]],
    [1, summary.distribution[1]],
  ];

  return (
    <div className="rounded-card bg-white p-4 shadow-card">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="font-display text-4xl font-extrabold text-ink">
            {summary.average.toFixed(1)}
          </p>
          <StarRating value={summary.average} readOnly size="sm" />
          <p className="mt-1 text-xs text-muted">
            {summary.total} {summary.total === 1 ? "opinión" : "opiniones"}
          </p>
        </div>

        <div className="flex-1 space-y-1">
          {rows.map(([stars, count]) => {
            const pct = summary.total ? (count / summary.total) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-right text-muted">{stars}</span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-pill bg-surface">
                  <div
                    className="absolute inset-y-0 left-0 bg-amber"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-6 text-muted">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
