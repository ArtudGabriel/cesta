"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { catalogService } from "../services/catalog.service";
import type { Category, ProductFilters } from "../types/catalog.types";

export const CATALOG_KEYS = {
  supermarkets: ["catalog", "supermarkets"] as const,
  categories: ["catalog", "categories"] as const,
  products: (filters?: ProductFilters) =>
    ["catalog", "products", filters ?? {}] as const,
  productsInfinite: (filters?: ProductFilters) =>
    ["catalog", "products-infinite", filters ?? {}] as const,
  product: (id: string) => ["catalog", "product", id] as const,
};

// Sprint 76 (P5): staleTime tuning. Catálogo muda a cada cron de sync (3-4am),
// supermarkets/categories praticamente nunca. Menos refetch = menos API calls
// e cold-start hits no Render free tier.
const STALE_CATALOG = 5 * 60 * 1000;
const STALE_REFERENCE = 60 * 60 * 1000;

export function useSupermarkets() {
  return useQuery({
    queryKey: CATALOG_KEYS.supermarkets,
    queryFn: catalogService.listSupermarkets,
    staleTime: STALE_REFERENCE,
  });
}

// Sprint 227 (#2 perf): initialData opcional pra hidratar com payload SSR
// (page.tsx fetch com next:{revalidate}). Evita flash skeleton de chips na
// home no cold load.
export function useCategories(options?: { initialData?: Category[] }) {
  return useQuery({
    queryKey: CATALOG_KEYS.categories,
    queryFn: catalogService.listCategories,
    staleTime: STALE_REFERENCE,
    initialData: options?.initialData,
  });
}

export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: CATALOG_KEYS.products(filters),
    queryFn: () => catalogService.listProducts(filters),
    staleTime: STALE_CATALOG,
    placeholderData: (prev) => prev,
  });
}

// Sprint 76 (P5): infinite scroll pra Home. Backend já suporta page/limit via
// Prisma skip/take. Cada página puxa 20 produtos; hasNext decidido por
// meta.pagination.totalPages.
export function useProductsInfinite(filters: ProductFilters = {}) {
  const pageSize = filters.limit ?? 20;
  return useInfiniteQuery({
    queryKey: CATALOG_KEYS.productsInfinite(filters),
    queryFn: ({ pageParam = 1 }) =>
      catalogService.listProducts({
        ...filters,
        page: pageParam as number,
        limit: pageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const p = lastPage.meta.pagination;
      if (!p) return undefined;
      return p.page < p.totalPages ? p.page + 1 : undefined;
    },
    staleTime: STALE_CATALOG,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: CATALOG_KEYS.product(id),
    queryFn: () => catalogService.getProduct(id),
    staleTime: STALE_CATALOG,
    enabled: Boolean(id),
  });
}
