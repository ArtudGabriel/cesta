import type { Schemas } from "@/types/api";

/**
 * Sprint 212 — response types adotam baseline (S211 ADR 0024). Request
 * payloads continuam S210 (CreateAlertDto). Zero paralelo.
 *
 * G3 (DoD S212) preservações locais:
 *   - `AlertType` — baseline `AlertResponseDto.type: string` perde o enum
 *     (backend @ApiProperty não envia `enum: [...]` nessa coluna). Narrow
 *     enum reprojetado via `Omit<..., "type">` ⊕ `{ type: AlertType }` pra
 *     compiler + UI discriminarem. Flag ADR 0024 follow-up backend decorator.
 *   - `AlertRule.rules` — baseline `AlertRuleResponseDto.rules:
 *     Record<string, never>` é polimórfico sem oneOf no OpenAPI schema;
 *     combo/trend/bundle derivam do campo `type`. Union handcrafted
 *     (business-logic discriminated) até backend emitir oneOf.
 *   - `ComboRulePayload`/`TrendRulePayload`/`BundleRulePayload` —
 *     request shapes dos 3 sub-endpoints `/alerts/{combo,trend,bundle}`,
 *     continuam locais (não há DTOs baseline distintos emitidos).
 */

export type AlertType =
  | "promotion"
  | "target_price"
  | "promotion_ending"
  | "back_in_stock";

export type AlertTrigger = Schemas["AlertTriggerDto"];

export type Alert = Omit<Schemas["AlertResponseDto"], "type"> & {
  type: AlertType;
};

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
