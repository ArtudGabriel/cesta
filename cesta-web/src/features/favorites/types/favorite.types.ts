import type { UnitPrice } from "@/features/catalog/types/catalog.types";

export interface FavoriteProduct {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
}

export interface CheapestPrice {
  price: number;
  supermarketSlug: string;
  supermarketName: string;
  unitPrice: UnitPrice | null;
}

export interface Favorite {
  id: string;
  productId: string;
  createdAt: string;
  product?: FavoriteProduct;
  cheapestPrice?: CheapestPrice | null;
}
