import { api } from "@/lib/api";
import type { Product } from "../types/catalog.types";

interface Envelope<T> {
  data: T;
}

export const featuredDealsService = {
  async fetch(limit = 10): Promise<Product[]> {
    const { data } = await api.get<Envelope<Product[]>>(
      "/products/featured-deals",
      { params: { limit } },
    );
    return data.data;
  },
};
