"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { familyBasketService } from "../services/family-basket.service";

export const FAMILY_KEYS = {
  questions: ["family", "questions"] as const,
  profile: ["family", "profile"] as const,
  latest: ["family", "basket", "latest"] as const,
  basket: (id: string) => ["family", "basket", id] as const,
};

export function useDietaryQuestions() {
  return useQuery({
    queryKey: FAMILY_KEYS.questions,
    queryFn: familyBasketService.listQuestions,
    staleTime: 60 * 60 * 1000,
  });
}

export function useFamilyProfile(enabled: boolean) {
  return useQuery({
    queryKey: FAMILY_KEYS.profile,
    queryFn: familyBasketService.getProfile,
    enabled,
  });
}

export function useLatestBasket(enabled: boolean) {
  return useQuery({
    queryKey: FAMILY_KEYS.latest,
    queryFn: familyBasketService.latest,
    enabled,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 2000 : false,
  });
}

export function useUpsertProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: familyBasketService.upsertProfile,
    onSuccess: (profile) => {
      qc.setQueryData(FAMILY_KEYS.profile, profile);
      toast.success("Perfil guardado");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateBasket() {
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => familyBasketService.generate(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FAMILY_KEYS.latest });
      router.push("/minha-cesta");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRegenerateBasket(basketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => familyBasketService.regenerate(basketId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FAMILY_KEYS.latest });
      qc.invalidateQueries({ queryKey: FAMILY_KEYS.basket(basketId) });
      toast.success("Regenerando cesta…");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddBasketItem(basketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { productId: string; quantity?: number }) =>
      familyBasketService.addItem(basketId, payload),
    onSuccess: (basket) => {
      qc.setQueryData(FAMILY_KEYS.latest, basket);
      qc.setQueryData(FAMILY_KEYS.basket(basketId), basket);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateBasketItem(basketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      payload,
    }: {
      itemId: string;
      payload: { quantity?: number; isRequired?: boolean; isLocked?: boolean };
    }) => familyBasketService.updateItem(basketId, itemId, payload),
    onSuccess: (basket) => {
      qc.setQueryData(FAMILY_KEYS.latest, basket);
      qc.setQueryData(FAMILY_KEYS.basket(basketId), basket);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveBasketItem(basketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      familyBasketService.removeItem(basketId, itemId),
    onSuccess: (basket) => {
      qc.setQueryData(FAMILY_KEYS.latest, basket);
      qc.setQueryData(FAMILY_KEYS.basket(basketId), basket);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
