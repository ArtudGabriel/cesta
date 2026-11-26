import { api } from "@/lib/api";
import {
  recordProductsFetch,
  recordSuggestRequest,
} from "@/lib/sentry-breadcrumbs";
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

function errorCode(err: unknown): string | undefined {
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; errorCode?: unknown };
    if (typeof e.errorCode === "string") return e.errorCode;
    if (typeof e.code === "string") return e.code;
  }
  return undefined;
}

function errorStatus(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const e = err as { status?: unknown };
    if (typeof e.status === "number") return e.status;
  }
  return undefined;
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
    const started = Date.now();
    try {
      const { data } = await api.get<Envelope<Product[]>>("/products", {
        params: filters,
      });
      recordProductsFetch({
        route: "/products",
        filters: filters as Record<string, unknown>,
        resultCount: data.data.length,
        total: data.meta?.pagination?.total,
        status: 200,
        durationMs: Date.now() - started,
        success: true,
      });
      return { items: data.data, meta: data.meta };
    } catch (err) {
      recordProductsFetch({
        route: "/products",
        filters: filters as Record<string, unknown>,
        status: errorStatus(err),
        errorCode: errorCode(err),
        durationMs: Date.now() - started,
        success: false,
      });
      throw err;
    }
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
    const started = Date.now();
    recordSuggestRequest("start", { query: q });
    try {
      const { data } = await api.get<Envelope<{ suggestions: Suggestion[] }>>(
        "/products/suggest",
        { params: { q, limit } },
      );
      recordSuggestRequest("success", {
        query: q,
        resultCount: data.data.suggestions.length,
        status: 200,
        durationMs: Date.now() - started,
      });
      return data.data.suggestions;
    } catch (err) {
      recordSuggestRequest("failure", {
        query: q,
        status: errorStatus(err),
        errorCode: errorCode(err),
        durationMs: Date.now() - started,
      });
      throw err;
    }
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
