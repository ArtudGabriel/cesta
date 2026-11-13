"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { shoppingListsService } from "../services/shopping-lists.service";
import type { ShoppingList } from "../types/shopping-list.types";

export const LIST_KEYS = {
  all: ["shopping-lists"] as const,
  one: (id: string) => ["shopping-lists", id] as const,
  totals: (id: string) => ["shopping-lists", id, "totals"] as const,
};

export function useLists() {
  return useQuery({
    queryKey: LIST_KEYS.all,
    queryFn: shoppingListsService.list,
  });
}

export function useList(
  id: string,
  options?: { initialData?: ShoppingList },
) {
  return useQuery({
    queryKey: LIST_KEYS.one(id),
    queryFn: () => shoppingListsService.get(id),
    enabled: Boolean(id),
    initialData: options?.initialData,
  });
}

export function useListTotals(id: string) {
  return useQuery({
    queryKey: LIST_KEYS.totals(id),
    queryFn: () => shoppingListsService.totals(id),
    enabled: Boolean(id),
    staleTime: 0, // sempre fresco — core da feature é tempo real
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (name: string) => shoppingListsService.create(name),
    onSuccess: (list) => {
      qc.invalidateQueries({ queryKey: LIST_KEYS.all });
      toast.success("Lista creada");
      router.push(`/minha-lista/${list.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRenameList(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => shoppingListsService.rename(id, name),
    onSuccess: (list) => {
      qc.setQueryData(LIST_KEYS.one(id), list);
      qc.invalidateQueries({ queryKey: LIST_KEYS.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (id: string) => shoppingListsService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEYS.all });
      toast.success("Lista eliminada");
      router.push("/minha-lista");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { productId: string; quantity?: number }) =>
      shoppingListsService.addItem(listId, payload),
    onSuccess: (list) => {
      qc.setQueryData(LIST_KEYS.one(listId), list);
      qc.invalidateQueries({ queryKey: LIST_KEYS.totals(listId) });
      qc.invalidateQueries({ queryKey: LIST_KEYS.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      shoppingListsService.updateItem(listId, itemId, quantity),
    onSuccess: (list) => {
      qc.setQueryData(LIST_KEYS.one(listId), list);
      qc.invalidateQueries({ queryKey: LIST_KEYS.totals(listId) });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      shoppingListsService.removeItem(listId, itemId),
    onSuccess: (list) => {
      qc.setQueryData(LIST_KEYS.one(listId), list);
      qc.invalidateQueries({ queryKey: LIST_KEYS.totals(listId) });
      qc.invalidateQueries({ queryKey: LIST_KEYS.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
