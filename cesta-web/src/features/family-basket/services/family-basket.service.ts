import { api } from "@/lib/api";
import type {
  DietaryQuestion,
  FamilyBasket,
  FamilyProfile,
  GenerateBasketResponse,
} from "../types/family-basket.types";

interface Envelope<T> {
  data: T;
}

type UpsertProfilePayload = {
  members: FamilyProfile["members"];
  answers: FamilyProfile["answers"];
  restrictions?: string[];
  blockedCategories?: string[];
  requiredProductIds?: string[];
};

export const familyBasketService = {
  async listQuestions(): Promise<DietaryQuestion[]> {
    const { data } = await api.get<Envelope<DietaryQuestion[]>>(
      "/family-profiles/questions",
    );
    return data.data;
  },

  async getProfile(): Promise<FamilyProfile | null> {
    const { data } = await api.get<Envelope<FamilyProfile | null>>(
      "/family-profiles/me",
    );
    return data.data;
  },

  async upsertProfile(payload: UpsertProfilePayload): Promise<FamilyProfile> {
    const { data } = await api.put<Envelope<FamilyProfile>>(
      "/family-profiles/me",
      payload,
    );
    return data.data;
  },

  async generate(): Promise<GenerateBasketResponse> {
    const { data } = await api.post<Envelope<GenerateBasketResponse>>(
      "/family-baskets/generate",
    );
    return data.data;
  },

  async regenerate(basketId: string): Promise<GenerateBasketResponse> {
    const { data } = await api.post<Envelope<GenerateBasketResponse>>(
      `/family-baskets/${basketId}/regenerate`,
    );
    return data.data;
  },

  async latest(): Promise<FamilyBasket | null> {
    const { data } = await api.get<Envelope<FamilyBasket | null>>(
      "/family-baskets/latest",
    );
    return data.data;
  },

  async get(basketId: string): Promise<FamilyBasket> {
    const { data } = await api.get<Envelope<FamilyBasket>>(
      `/family-baskets/${basketId}`,
    );
    return data.data;
  },

  async addItem(
    basketId: string,
    payload: { productId: string; quantity?: number; isRequired?: boolean; isLocked?: boolean },
  ): Promise<FamilyBasket> {
    const { data } = await api.post<Envelope<FamilyBasket>>(
      `/family-baskets/${basketId}/items`,
      payload,
    );
    return data.data;
  },

  async updateItem(
    basketId: string,
    itemId: string,
    payload: { quantity?: number; isRequired?: boolean; isLocked?: boolean },
  ): Promise<FamilyBasket> {
    const { data } = await api.patch<Envelope<FamilyBasket>>(
      `/family-baskets/${basketId}/items/${itemId}`,
      payload,
    );
    return data.data;
  },

  async removeItem(basketId: string, itemId: string): Promise<FamilyBasket> {
    const { data } = await api.delete<Envelope<FamilyBasket>>(
      `/family-baskets/${basketId}/items/${itemId}`,
    );
    return data.data;
  },
};
