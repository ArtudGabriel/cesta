import { api } from "@/lib/api";
import type {
  ListTotals,
  ShoppingList,
} from "../types/shopping-list.types";

interface Envelope<T> {
  data: T;
}

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
    const { data } = await api.post<Envelope<ShoppingList>>("/shopping-lists", {
      name,
    });
    return data.data;
  },

  async rename(id: string, name: string): Promise<ShoppingList> {
    const { data } = await api.patch<Envelope<ShoppingList>>(
      `/shopping-lists/${id}`,
      { name },
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
    const { data } = await api.post<Envelope<ShoppingList>>(
      `/shopping-lists/${id}/items`,
      payload,
    );
    return data.data;
  },

  async updateItem(
    id: string,
    itemId: string,
    quantity: number,
  ): Promise<ShoppingList> {
    const { data } = await api.patch<Envelope<ShoppingList>>(
      `/shopping-lists/${id}/items/${itemId}`,
      { quantity },
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
