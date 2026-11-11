"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { reviewsService } from "../services/reviews.service";
import type {
  CreateReviewPayload,
  ReviewSort,
  UpdateReviewPayload,
} from "../types/review.types";

export const REVIEW_KEYS = {
  list: (productId: string, sortBy?: ReviewSort) =>
    ["reviews", productId, "list", sortBy ?? "recent"] as const,
  summary: (productId: string) => ["reviews", productId, "summary"] as const,
  mine: (productId: string) => ["reviews", productId, "mine"] as const,
};

export function useProductReviews(
  productId: string,
  sortBy: ReviewSort = "recent",
) {
  return useQuery({
    queryKey: REVIEW_KEYS.list(productId, sortBy),
    queryFn: () => reviewsService.listByProduct(productId, { sortBy }),
    enabled: Boolean(productId),
  });
}

export function useReviewSummary(productId: string) {
  return useQuery({
    queryKey: REVIEW_KEYS.summary(productId),
    queryFn: () => reviewsService.summary(productId),
    enabled: Boolean(productId),
  });
}

export function useMyReview(productId: string, enabled: boolean) {
  return useQuery({
    queryKey: REVIEW_KEYS.mine(productId),
    queryFn: () => reviewsService.mine(productId),
    enabled: enabled && Boolean(productId),
  });
}

function invalidateProductReviews(
  qc: ReturnType<typeof useQueryClient>,
  productId: string,
) {
  qc.invalidateQueries({ queryKey: ["reviews", productId] });
}

export function useCreateReview(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateReviewPayload) =>
      reviewsService.create(payload),
    onSuccess: () => {
      invalidateProductReviews(qc, productId);
      toast.success("Avaliação publicada");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateReview(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateReviewPayload }) =>
      reviewsService.update(id, payload),
    onSuccess: () => {
      invalidateProductReviews(qc, productId);
      toast.success("Avaliação atualizada");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteReview(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reviewsService.remove(id),
    onSuccess: () => {
      invalidateProductReviews(qc, productId);
      toast.success("Avaliação excluída");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useToggleHelpful(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reviewsService.toggleHelpful(id),
    onSuccess: () => {
      invalidateProductReviews(qc, productId);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReportReview() {
  return useMutation({
    mutationFn: (id: string) => reviewsService.report(id),
    onSuccess: () => toast.success("Reporte enviado"),
    onError: (err: Error) => toast.error(err.message),
  });
}
