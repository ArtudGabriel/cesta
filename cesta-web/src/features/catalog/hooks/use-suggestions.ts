"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { catalogService } from "../services/catalog.service";

export function useSuggestions(q: string, limit = 8) {
  return useQuery({
    queryKey: ["suggestions", q, limit],
    queryFn: () => catalogService.suggest(q, limit),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
