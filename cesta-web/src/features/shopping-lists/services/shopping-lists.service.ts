import { api } from "@/lib/api";
import type { Schemas } from "@/types/api";
import type {
  ListTotals,
  ShoppingList,
} from "../types/shopping-list.types";

interface Envelope<T> {
  data: T;
}

/**
 * Sprint 210 — request payloads tipados via baseline Schemas (S209 ADR
 * 0022). Response (ShoppingList, ListTotals) handcrafted — baseline sofre
 * `Record<string, never> | null` em campos nullable (ADR 0023).
 */
type CreateListDto = Schemas["CreateListDto"];
type UpdateListDto = Schemas["UpdateListDto"];
type AddItemDto = Schemas["AddItemDto"];
type UpdateItemDto = Schemas["UpdateItemDto"];

export const shoppingListsService = {
  async list(): Promise<ShoppingList[]> {
    const { data } = await api.get<Envelope<ShoppingList[]>>("/shopping-lists");
    return data.data;
  },

  async get(id: string): Promise<ShoppingList> {
    const { data } = await api.get<Envelope<ShoppingList>>(
      `/shopping-lists/${id}`,
    );
    return data.data;
  },

  async create(name: string): Promise<ShoppingList> {
    const payload: CreateListDto = { name };
    const { data } = await api.post<Envelope<ShoppingList>>(
      "/shopping-lists",
      payload,
    );
    return data.data;
  },

  async rename(id: string, name: string): Promise<ShoppingList> {
    const payload: UpdateListDto = { name };
    const { data } = await api.patch<Envelope<ShoppingList>>(
      `/shopping-lists/${id}`,
      payload,
    );
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/shopping-lists/${id}`);
  },

  async duplicate(id: string): Promise<ShoppingList> {
    const { data } = await api.post<Envelope<ShoppingList>>(
      `/shopping-lists/${id}/duplicate`,
    );
    return data.data;
  },

  async addItem(
    id: string,
    payload: { productId: string; quantity?: number },
  ): Promise<ShoppingList> {
    const dto: AddItemDto = {
      productId: payload.productId,
      quantity: payload.quantity ?? 1,
    };
    const { data } = await api.post<Envelope<ShoppingList>>(
      `/shopping-lists/${id}/items`,
      dto,
    );
    return data.data;
  },

  async updateItem(
    id: string,
    itemId: string,
    quantity: number,
  ): Promise<ShoppingList> {
    const dto: UpdateItemDto = { quantity };
    const { data } = await api.patch<Envelope<ShoppingList>>(
      `/shopping-lists/${id}/items/${itemId}`,
      dto,
    );
    return data.data;
  },

  async removeItem(id: string, itemId: string): Promise<ShoppingList> {
    const { data } = await api.delete<Envelope<ShoppingList>>(
      `/shopping-lists/${id}/items/${itemId}`,
    );
    return data.data;
  },

  async totals(id: string): Promise<ListTotals> {
    const { data } = await api.get<Envelope<ListTotals>>(
      `/shopping-lists/${id}/totals`,
    );
    return data.data;
  },
};
