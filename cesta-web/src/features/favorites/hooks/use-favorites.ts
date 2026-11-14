"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
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

/**
 * Sprint 66 nit: aceita `initialData` opcional pra evitar flash 1-frame
 * quando o caller já sabe o estado inicial (ex: página /favoritos que lista
 * tudo). Enquanto a query global ainda não resolveu, retorna o initial;
 * depois passa a refletir o cache real.
 */
export function useIsFavorite(
  productId: string,
  options?: { initialData?: boolean },
): boolean {
  const { data } = useFavorites();
  if (data === undefined && options?.initialData !== undefined) {
    return options.initialData;
  }
  return Boolean(data?.some((f) => f.productId === productId));
}

export function useAddFavorite() {
  const qc = useQueryClient();
  const t = useTranslations("toast");
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
      toast.error(err.message || t("error.favoriteAdd"));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: FAV_KEYS.list });
    },
  });
}

export function useRemoveFavorite() {
  const qc = useQueryClient();
  const t = useTranslations("toast");
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
      toast.error(err.message || t("error.favoriteRemove"));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: FAV_KEYS.list });
    },
  });
}
