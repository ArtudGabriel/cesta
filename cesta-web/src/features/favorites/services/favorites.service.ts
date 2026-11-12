import { api } from "@/lib/api";
import type { Favorite } from "../types/favorite.types";

interface Envelope<T> {
  data: T;
}

export const favoritesService = {
  async list(): Promise<Favorite[]> {
    const { data } = await api.get<Envelope<Favorite[]>>("/favorites");
    return data.data;
  },

  async add(productId: string): Promise<Favorite> {
    const { data } = await api.post<Envelope<Favorite>>("/favorites", {
      productId,
    });
    return data.data;
  },

  async remove(productId: string): Promise<void> {
    await api.delete(`/favorites/${productId}`);
  },

  async check(productIds: string[]): Promise<string[]> {
    if (productIds.length === 0) return [];
    const { data } = await api.get<Envelope<{ favorited: string[] }>>(
      "/favorites/check",
      { params: { productIds: productIds.join(",") } },
    );
    return data.data.favorited;
  },
};
