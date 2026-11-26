import type { Schemas } from "@/types/api";

/**
 * Sprint 210 — request payloads adotam baseline Schemas (S209 ADR 0022).
 * Response types (Review, ReviewSummary) handcrafted — baseline sofre
 * `Record<string, never> | null` em comment/authorName (ADR 0023).
 */

export interface Review {
  id: string;
  productId: string;
  rating: number;
  comment: string | null;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorName: string | null;
  markedHelpful: boolean;
}

export interface ReviewSummary {
  average: number;
  total: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export type CreateReviewPayload = Schemas["CreateReviewDto"];

export type UpdateReviewPayload = Schemas["UpdateReviewDto"];

export type ReviewSort = "recent" | "helpful" | "rating_desc" | "rating_asc";
