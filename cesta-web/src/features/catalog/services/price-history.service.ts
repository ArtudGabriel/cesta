import { api } from "@/lib/api";

export interface PriceHistoryPoint {
  date: string;
  price: number;
  onPromotion: boolean;
}

export interface PriceHistorySeries {
  supermarketId: string;
  supermarketSlug: string;
  supermarketName: string;
  supermarketColor: string | null;
  points: PriceHistoryPoint[];
}

interface Envelope<T> {
  data: T;
}

export const priceHistoryService = {
  async get(
    productId: string,
    options: { supermarketId?: string; days?: number } = {},
  ): Promise<PriceHistorySeries[]> {
    const { data } = await api.get<Envelope<PriceHistorySeries[]>>(
      `/products/${productId}/price-history`,
      { params: { supermarketId: options.supermarketId, days: options.days ?? 30 } },
    );
    return data.data;
  },
};
