import { api } from "@/lib/api";
import type { Product } from "../types/catalog.types";

interface Envelope<T> {
  data: T;
}

export const compareService = {
  async fetch(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    const { data } = await api.get<Envelope<Product[]>>("/products/compare", {
      params: { ids: ids.join(",") },
    });
    return data.data;
  },
};
