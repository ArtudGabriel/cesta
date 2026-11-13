"use client";

import { useQuery } from "@tanstack/react-query";
import { compareService } from "../services/compare.service";
import type { Product } from "../types/catalog.types";

export function useCompare(
  ids: string[],
  options?: { initialData?: Product[] },
) {
  const key = [...ids].sort().join(",");
  return useQuery({
    queryKey: ["compare", key],
    queryFn: () => compareService.fetch(ids),
    enabled: ids.length >= 2,
    staleTime: 5 * 60 * 1000,
    initialData: options?.initialData,
  });
}
