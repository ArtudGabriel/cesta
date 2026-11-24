import { api } from "@/lib/api";
import type {
  Category,
  Paginated,
  Product,
  ProductFilters,
  Supermarket,
} from "../types/catalog.types";

interface Envelope<T> {
  data: T;
  meta: Paginated<unknown>["meta"];
}

export const catalogService = {
  async listSupermarkets(): Promise<Supermarket[]> {
    const { data } = await api.get<Envelope<Supermarket[]>>("/supermarkets");
    return data.data;
  },

  async listCategories(): Promise<Category[]> {
    const { data } = await api.get<Envelope<Category[]>>("/categories");
    return data.data;
  },

  async listProducts(filters: ProductFilters = {}): Promise<Paginated<Product>> {
    const { data } = await api.get<Envelope<Product[]>>("/products", {
      params: filters,
    });
    return { items: data.data, meta: data.meta };
  },

  async getProduct(id: string): Promise<Product> {
    const { data } = await api.get<Envelope<Product>>(`/products/${id}`);
    return data.data;
  },

  async compare(ids: string[]): Promise<Product[]> {
    const { data } = await api.get<Envelope<Product[]>>("/products/compare", {
      params: { ids: ids.join(",") },
    });
    return data.data;
  },

  async suggest(q: string, limit = 8): Promise<Suggestion[]> {
    const { data } = await api.get<Envelope<{ suggestions: Suggestion[] }>>(
      "/products/suggest",
      { params: { q, limit } },
    );
    return data.data.suggestions;
  },
};

export interface Suggestion {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  cheapestPrice: {
    value: number;
    supermarketSlug: string;
    supermarketName: string;
  } | null;
}
