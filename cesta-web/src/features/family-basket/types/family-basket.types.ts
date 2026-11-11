import type { Product } from "@/features/catalog/types/catalog.types";

export interface DietaryQuestion {
  id: string;
  key: string;
  labelEs: string;
  labelPt: string;
  type: "boolean" | "choice";
  options: Array<{ value: string; labelEs: string; labelPt: string }> | null;
  category: string | null;
  order: number;
}

export interface FamilyMembers {
  babies: number;
  kids: number;
  children: number;
  teens: number;
  adults: number;
  seniors: number;
}

export interface FamilyProfile {
  id: string;
  members: FamilyMembers;
  answers: Record<string, boolean | string>;
  restrictions: string[];
  blockedCategories: string[];
  requiredProductIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BasketItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isRequired: boolean;
  isLocked: boolean;
  position: number;
  product: Product;
}

export interface FamilyBasket {
  id: string;
  status: "pending" | "ready" | "failed";
  errorMessage: string | null;
  estimatedCost: number;
  generatedAt: string;
  updatedAt: string;
  items: BasketItem[];
}

export interface GenerateBasketResponse {
  jobId: string;
  status: string;
  basketId: string;
}
