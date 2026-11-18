import { api } from "@/lib/api";

interface Envelope<T> {
  data: T;
}

export interface ProductSearchItem {
  id: string;
  name: string;
  imageUrl: string | null;
  cheapestUnitPrice: number | null;
}

export interface ProductSearchResponse {
  items: ProductSearchItem[];
  total: number;
}

export const productsService = {
  async search(q: string, limit = 10): Promise<ProductSearchResponse> {
    const { data } = await api.get<Envelope<ProductSearchResponse>>(
      "/products/search",
      { params: { q, limit } },
    );
    return data.data;
  },
};
