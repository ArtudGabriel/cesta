"use client";

import { useQuery } from "@tanstack/react-query";
import { catalogService } from "../services/catalog.service";
import type { ProductFilters } from "../types/catalog.types";

export const CATALOG_KEYS = {
  supermarkets: ["catalog", "supermarkets"] as const,
  categories: ["catalog", "categories"] as const,
  products: (filters?: ProductFilters) =>
    ["catalog", "products", filters ?? {}] as const,
  product: (id: string) => ["catalog", "product", id] as const,
};

export function useSupermarkets() {
  return useQuery({
    queryKey: CATALOG_KEYS.supermarkets,
    queryFn: catalogService.listSupermarkets,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: CATALOG_KEYS.categories,
    queryFn: catalogService.listCategories,
    staleTime: 10 * 60 * 1000,
  });
}

export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: CATALOG_KEYS.products(filters),
    queryFn: () => catalogService.listProducts(filters),
    placeholderData: (prev) => prev,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: CATALOG_KEYS.product(id),
    queryFn: () => catalogService.getProduct(id),
    enabled: Boolean(id),
  });
}
