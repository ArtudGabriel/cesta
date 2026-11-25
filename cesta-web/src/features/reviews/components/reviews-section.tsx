"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LoginGate } from "@/components/login-gate";
import { useAuthStore } from "@/stores/auth.store";
import {
  useCreateReview,
  useMyReview,
  useProductReviews,
  useReviewSummary,
  useUpdateReview,
} from "../hooks/use-reviews";
import type { ReviewSort } from "../types/review.types";
import { ReviewCard } from "./review-card";
import { ReviewForm } from "./review-form";
import { ReviewSummary } from "./review-summary";

interface ReviewsSectionProps {
  productId: string;
}

const SORT_KEYS: Array<{ value: ReviewSort; key: string }> = [
  { value: "recent", key: "recent" },
  { value: "helpful", key: "helpful" },
  { value: "rating_desc", key: "ratingDesc" },
  { value: "rating_asc", key: "ratingAsc" },
];

export function ReviewsSection({ productId }: ReviewsSectionProps) {
  const user = useAuthStore((s) => s.user);
  const [sortBy, setSortBy] = useState<ReviewSort>("recent");
  const [commentsOnly, setCommentsOnly] = useState(false);
  const [editing, setEditing] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const t = useTranslations("reviews");

  const summary = useReviewSummary(productId);
  const reviews = useProductReviews(productId, sortBy);
  const mine = useMyReview(productId, Boolean(user));
  const createReview = useCreateReview(productId);
  const updateReview = useUpdateReview(productId);

  const isAuthenticated = Boolean(user);
  const myReview = mine.data;

  return (
    <section className="space-y-4">
      {summary.data && summary.data.total > 0 ? (
        <ReviewSummary summary={summary.data} />
      ) : (
        <p className="text-sm text-muted">{t("emptySummary")}</p>
      )}

      {!isAuthenticated ? (
        <button
          type="button"
          onClick={() => setGateOpen(true)}
          className="w-full rounded-card border border-border bg-surface p-4 text-center text-sm text-muted hover:bg-neutral-100 cursor-pointer"
        >
          <span className="font-medium text-cesta-green">
            {t("loginPrefix")}
          </span>
          {t("loginSuffix")}
        </button>
      ) : editing || !myReview ? (
        <div className="rounded-card bg-white p-4 shadow-card">
          <h4 className="mb-3 font-display font-bold text-ink">
            {myReview ? t("formEditTitle") : t("formNewTitle")}
          </h4>
          <ReviewForm
            initial={myReview ?? undefined}
            isSubmitting={createReview.isPending || updateReview.isPending}
            onSubmit={(data) => {
              if (myReview) {
                updateReview.mutate(
                  {
                    id: myReview.id,
                    payload: { rating: data.rating, comment: data.comment },
                  },
                  { onSuccess: () => setEditing(false) },
                );
              } else {
                createReview.mutate({
                  productId,
                  rating: data.rating,
                  comment: data.comment,
                });
              }
            }}
            onCancel={myReview ? () => setEditing(false) : undefined}
          />
        </div>
      ) : (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {t("myReviewLabel")}
          </p>
          <ReviewCard
            review={myReview}
            currentUserId={user?.id}
            productId={productId}
            onEdit={() => setEditing(true)}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display font-bold text-ink">{t("allHeader")}</h4>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={commentsOnly}
              onChange={(e) => setCommentsOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-cesta-green cursor-pointer"
              data-testid="reviews-filter-comments-only"
            />
            {t("filterCommentsOnly")}
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as ReviewSort)}
            className="rounded-btn border border-border bg-white px-2 py-1 text-xs"
            data-testid="reviews-sort-select"
          >
            {SORT_KEYS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(`sort.${o.key}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {reviews.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-cesta-green" />
        </div>
      ) : (() => {
        const items = (reviews.data?.items ?? [])
          .filter((r) => r.authorId !== user?.id)
          .filter((r) => (commentsOnly ? Boolean(r.comment?.trim()) : true));
        if (items.length === 0) {
          return (
            <p className="py-6 text-center text-sm text-muted">
              {commentsOnly ? t("emptyListFiltered") : t("emptyList")}
            </p>
          );
        }
        return (
          <ul className="space-y-3" data-testid="reviews-list">
            {items.map((r) => (
              <li key={r.id}>
                <ReviewCard
                  review={r}
                  currentUserId={user?.id}
                  productId={productId}
                />
              </li>
            ))}
          </ul>
        );
      })()}

      <LoginGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        action="review"
      />
    </section>
  );
}
