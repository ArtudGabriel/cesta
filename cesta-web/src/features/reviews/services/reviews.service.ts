import { api } from "@/lib/api";
import type {
  CreateReviewPayload,
  Review,
  ReviewSort,
  ReviewSummary,
  UpdateReviewPayload,
} from "../types/review.types";

interface Envelope<T> {
  data: T;
}

export const reviewsService = {
  async listByProduct(
    productId: string,
    params: { page?: number; limit?: number; sortBy?: ReviewSort } = {},
  ): Promise<{ items: Review[]; total: number }> {
    const { data } = await api.get<Envelope<Review[]> & { meta?: unknown }>(
      `/products/${productId}/reviews`,
      { params },
    );
    const meta = (data as unknown as {
      meta?: { pagination?: { total?: number } };
    }).meta;
    return {
      items: data.data,
      total: meta?.pagination?.total ?? data.data.length,
    };
  },

  async summary(productId: string): Promise<ReviewSummary> {
    const { data } = await api.get<Envelope<ReviewSummary>>(
      `/products/${productId}/reviews/summary`,
    );
    return data.data;
  },

  async mine(productId: string): Promise<Review | null> {
    const { data } = await api.get<Envelope<Review | null>>(
      `/products/${productId}/reviews/mine`,
    );
    return data.data;
  },

  async create(payload: CreateReviewPayload): Promise<Review> {
    const { data } = await api.post<Envelope<Review>>("/reviews", payload);
    return data.data;
  },

  async update(id: string, payload: UpdateReviewPayload): Promise<Review> {
    const { data } = await api.patch<Envelope<Review>>(`/reviews/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/reviews/${id}`);
  },

  async toggleHelpful(
    id: string,
  ): Promise<{ markedHelpful: boolean; helpfulCount: number }> {
    const { data } = await api.post<
      Envelope<{ markedHelpful: boolean; helpfulCount: number }>
    >(`/reviews/${id}/helpful`);
    return data.data;
  },

  async report(id: string): Promise<void> {
    await api.post(`/reviews/${id}/report`);
  },
};
