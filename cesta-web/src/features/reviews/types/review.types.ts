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

export interface CreateReviewPayload {
  productId: string;
  rating: number;
  comment?: string;
}

export interface UpdateReviewPayload {
  rating?: number;
  comment?: string;
}

export type ReviewSort = "recent" | "helpful" | "rating_desc" | "rating_asc";
