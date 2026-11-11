export type AlertType =
  | "promotion"
  | "target_price"
  | "promotion_ending"
  | "back_in_stock";

export interface AlertTrigger {
  id: string;
  reason: string;
  priceSnapshot: number;
  notifiedAt: string | null;
  createdAt: string;
}

export interface Alert {
  id: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  supermarketId: string | null;
  supermarketName: string | null;
  type: AlertType;
  targetPrice: number | null;
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  triggers: AlertTrigger[];
}

export interface CreateAlertPayload {
  productId: string;
  supermarketId?: string;
  type: AlertType;
  targetPrice?: number;
}
