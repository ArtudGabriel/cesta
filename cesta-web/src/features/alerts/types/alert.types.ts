import type { Schemas } from "@/types/api";

/**
 * Sprint 210 — request payload adota baseline Schemas["CreateAlertDto"]
 * (S209 ADR 0022). Response shape handcrafted (Alert, AlertTrigger,
 * AlertRule) — baseline sofre `Record<string, never> | null` leak em
 * campos nullable (ADR 0023). Alvo S211+: backend @ApiProperty fix.
 */

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

export type CreateAlertPayload = Schemas["CreateAlertDto"];

// ──────────────────────────────────────────────────────────────
// Sprint 105 — alert rules compostas
// ──────────────────────────────────────────────────────────────

export type AlertRuleType = "combo" | "trend" | "bundle";

export interface ComboRulePayload {
  productIds: string[];
  targetTotal: number;
}

export interface TrendRulePayload {
  productId: string;
  consecutiveWeeks: number;
}

export interface BundleRulePayload {
  productIds: string[];
  targetSavings: number;
}

export type AlertRulesPayload =
  | ComboRulePayload
  | TrendRulePayload
  | BundleRulePayload;

export interface AlertRule {
  id: string;
  type: AlertRuleType;
  isActive: boolean;
  rules: AlertRulesPayload;
  lastTriggeredAt: string | null;
  createdAt: string;
}
