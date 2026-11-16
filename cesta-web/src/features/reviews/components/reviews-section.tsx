"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
  const [editing, setEditing] = useState(false);
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
        <div className="rounded-card border border-border bg-surface p-4 text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-cesta-green">
            {t("loginPrefix")}
          </Link>
          {t("loginSuffix")}
        </div>
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

      <div className="flex items-center justify-between">
        <h4 className="font-display font-bold text-ink">{t("allHeader")}</h4>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as ReviewSort)}
          className="rounded-btn border border-border bg-white px-2 py-1 text-xs"
        >
          {SORT_KEYS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(`sort.${o.key}`)}
            </option>
          ))}
        </select>
      </div>

      {reviews.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-cesta-green" />
        </div>
      ) : reviews.data && reviews.data.items.length > 0 ? (
        <ul className="space-y-3">
          {reviews.data.items
            .filter((r) => r.authorId !== user?.id)
            .map((r) => (
              <li key={r.id}>
                <ReviewCard
                  review={r}
                  currentUserId={user?.id}
                  productId={productId}
                />
              </li>
            ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-muted">{t("emptyList")}</p>
      )}
    </section>
  );
}
