"use client";

import { useQuery } from "@tanstack/react-query";
import { priceHistoryService } from "../services/price-history.service";

export function usePriceHistory(
  productId: string,
  options: { supermarketId?: string; days?: number } = {},
) {
  return useQuery({
    queryKey: [
      "price-history",
      productId,
      options.supermarketId ?? "all",
      options.days ?? 30,
    ],
    queryFn: () => priceHistoryService.get(productId, options),
    enabled: Boolean(productId),
    staleTime: 5 * 60 * 1000,
  });
}
