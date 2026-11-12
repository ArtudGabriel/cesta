"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { favoritesService } from "../services/favorites.service";
import type { Favorite } from "../types/favorite.types";
import { useAuthStore } from "@/stores/auth.store";

export const FAV_KEYS = {
  list: ["favorites"] as const,
};

export function useFavorites() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: FAV_KEYS.list,
    queryFn: favoritesService.list,
    enabled: Boolean(user),
  });
}

export function useIsFavorite(productId: string) {
  const { data } = useFavorites();
  return Boolean(data?.some((f) => f.productId === productId));
}

export function useAddFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => favoritesService.add(productId),
    onMutate: async (productId) => {
      await qc.cancelQueries({ queryKey: FAV_KEYS.list });
      const prev = qc.getQueryData<Favorite[]>(FAV_KEYS.list) ?? [];
      const optimistic: Favorite = {
        id: `tmp-${productId}`,
        productId,
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<Favorite[]>(FAV_KEYS.list, [optimistic, ...prev]);
      return { prev };
    },
    onError: (err: Error, _productId, ctx) => {
      if (ctx?.prev) qc.setQueryData(FAV_KEYS.list, ctx.prev);
      toast.error(err.message || "No se pudo añadir");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: FAV_KEYS.list });
    },
  });
}

export function useRemoveFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => favoritesService.remove(productId),
    onMutate: async (productId) => {
      await qc.cancelQueries({ queryKey: FAV_KEYS.list });
      const prev = qc.getQueryData<Favorite[]>(FAV_KEYS.list) ?? [];
      qc.setQueryData<Favorite[]>(
        FAV_KEYS.list,
        prev.filter((f) => f.productId !== productId),
      );
      return { prev };
    },
    onError: (err: Error, _productId, ctx) => {
      if (ctx?.prev) qc.setQueryData(FAV_KEYS.list, ctx.prev);
      toast.error(err.message || "No se pudo quitar");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: FAV_KEYS.list });
    },
  });
}
