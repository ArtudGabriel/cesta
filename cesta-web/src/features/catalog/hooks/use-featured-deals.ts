import { useQuery } from "@tanstack/react-query";
import { featuredDealsService } from "../services/featured-deals.service";
import type { Product } from "../types/catalog.types";

export function useFeaturedDeals(limit = 10) {
  return useQuery<Product[]>({
    queryKey: ["featured-deals", limit],
    queryFn: () => featuredDealsService.fetch(limit),
    staleTime: 5 * 60 * 1000,
  });
}
