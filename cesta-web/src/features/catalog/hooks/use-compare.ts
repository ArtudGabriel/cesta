"use client";

import { useQuery } from "@tanstack/react-query";
import { compareService } from "../services/compare.service";

export function useCompare(ids: string[]) {
  const key = [...ids].sort().join(",");
  return useQuery({
    queryKey: ["compare", key],
    queryFn: () => compareService.fetch(ids),
    enabled: ids.length >= 1,
    staleTime: 5 * 60 * 1000,
  });
}
