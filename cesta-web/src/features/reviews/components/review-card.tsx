"use client";

import { Flag, Pencil, ThumbsUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useDeleteReview,
  useReportReview,
  useToggleHelpful,
} from "../hooks/use-reviews";
import type { Review } from "../types/review.types";
import { StarRating } from "./star-rating";

interface ReviewCardProps {
  review: Review;
  currentUserId?: string | null;
  productId: string;
  onEdit?: () => void;
}

export function ReviewCard({
  review,
  currentUserId,
  productId,
  onEdit,
}: ReviewCardProps) {
  const toggleHelpful = useToggleHelpful(productId);
  const report = useReportReview();
  const deleteReview = useDeleteReview(productId);
  const isOwner = currentUserId === review.authorId;

  return (
    <article className="rounded-card bg-white p-4 shadow-card">
      <header className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {review.authorName ?? "Usuario"}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <StarRating value={review.rating} readOnly size="sm" />
            <span className="text-xs text-muted">
              {new Date(review.createdAt).toLocaleDateString("es-ES")}
            </span>
          </div>
        </div>

        {isOwner && (
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Editar"
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Eliminar"
              onClick={() => {
                if (confirm("¿Eliminar esta avaliação?")) {
                  deleteReview.mutate(review.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4 text-coral" />
            </Button>
          </div>
        )}
      </header>

      {review.comment && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-ink">
          {review.comment}
        </p>
      )}

      <footer className="mt-3 flex items-center gap-3 text-xs">
        <button
          onClick={() => {
            if (!currentUserId) return;
            toggleHelpful.mutate(review.id);
          }}
          disabled={isOwner || !currentUserId || toggleHelpful.isPending}
          className={cn(
            "inline-flex items-center gap-1 rounded-pill border border-border px-2 py-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
            review.markedHelpful && "border-cesta-green text-cesta-green",
          )}
        >
          <ThumbsUp className="h-3 w-3" />
          Útil · {review.helpfulCount}
        </button>

        {!isOwner && currentUserId && (
          <button
            onClick={() => report.mutate(review.id)}
            disabled={report.isPending}
            className="inline-flex items-center gap-1 text-muted hover:text-coral cursor-pointer"
          >
            <Flag className="h-3 w-3" />
            Reportar
          </button>
        )}
      </footer>
    </article>
  );
}
