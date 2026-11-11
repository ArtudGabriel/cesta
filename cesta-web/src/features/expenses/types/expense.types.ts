export interface ReceiptItem {
  id: string;
  rawText: string;
  normalizedName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  productId: string | null;
  productName: string | null;
  position: number;
}

export interface Receipt {
  id: string;
  status: "pending" | "processing" | "ready" | "failed";
  errorMessage: string | null;
  supermarketSlug: string | null;
  supermarketName: string | null;
  purchaseDate: string | null;
  total: number | null;
  imageUrl: string | null;
  notes: string | null;
  createdAt: string;
  items: ReceiptItem[];
}

export type Period = "day" | "week" | "month";

export interface ExpenseSummary {
  period: Period;
  from: string;
  to: string;
  total: number;
  count: number;
  previousTotal: number;
  deltaPct: number;
}

export interface ExpenseBucket {
  label: string;
  total: number;
  count: number;
}
