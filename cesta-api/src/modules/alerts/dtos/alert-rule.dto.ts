import { ApiProperty } from '@nestjs/swagger';
import { AlertRule } from '@prisma/client';
import { z } from 'zod';

// ──────────────────────────────────────────────────────────────────────
// Sprint 105 — Zod schemas boundary API↔Front (shape = openapi/alert-rules.yaml)
// ──────────────────────────────────────────────────────────────────────

export const ALERT_RULE_TYPES = ['combo', 'trend', 'bundle'] as const;
export type AlertRuleType = (typeof ALERT_RULE_TYPES)[number];

const CUID = z.string().regex(/^c[a-z0-9]{24}$/, 'invalid cuid');
const MONEY = z
  .number()
  .positive()
  .multipleOf(0.01, 'max 2 casas decimais');
const PRODUCT_IDS = z
  .array(CUID)
  .min(2, 'mínimo 2 produtos')
  .max(20, 'máximo 20 produtos');

export const comboRulesSchema = z.object({
  productIds: PRODUCT_IDS,
  targetTotal: MONEY,
});

export const trendRulesSchema = z.object({
  productId: CUID,
  consecutiveWeeks: z.number().int().min(2).max(12),
});

export const bundleRulesSchema = z.object({
  productIds: PRODUCT_IDS,
  targetSavings: MONEY,
});

export type ComboRules = z.infer<typeof comboRulesSchema>;
export type TrendRules = z.infer<typeof trendRulesSchema>;
export type BundleRules = z.infer<typeof bundleRulesSchema>;
export type AlertRulePayload = ComboRules | TrendRules | BundleRules;

export function schemaFor(type: AlertRuleType): z.ZodSchema<AlertRulePayload> {
  switch (type) {
    case 'combo':
      return comboRulesSchema;
    case 'trend':
      return trendRulesSchema;
    case 'bundle':
      return bundleRulesSchema;
  }
}

// Canonical hash para duplicate detection: ordena arrays + normaliza numbers
export function canonicalKey(type: AlertRuleType, rules: AlertRulePayload): string {
  if (type === 'trend') {
    const r = rules as TrendRules;
    return JSON.stringify({ type, productId: r.productId, consecutiveWeeks: r.consecutiveWeeks });
  }
  if (type === 'combo') {
    const r = rules as ComboRules;
    const ids = [...r.productIds].sort();
    return JSON.stringify({ type, productIds: ids, targetTotal: Number(r.targetTotal.toFixed(2)) });
  }
  const r = rules as BundleRules;
  const ids = [...r.productIds].sort();
  return JSON.stringify({ type, productIds: ids, targetSavings: Number(r.targetSavings.toFixed(2)) });
}

// ──────────────────────────────────────────────────────────────────────
// Response DTO (Swagger-visible)
// ──────────────────────────────────────────────────────────────────────

export class AlertRuleResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ALERT_RULE_TYPES }) type: AlertRuleType;
  @ApiProperty() isActive: boolean;
  @ApiProperty({
    description: 'Payload polimórfico: combo/bundle = {productIds, target*}; trend = {productId, consecutiveWeeks}',
  })
  rules: AlertRulePayload;
  @ApiProperty({ type: Date, nullable: true }) lastTriggeredAt: Date | null;
  @ApiProperty() createdAt: Date;

  static fromEntity(entity: AlertRule): AlertRuleResponseDto {
    const dto = new AlertRuleResponseDto();
    dto.id = entity.id;
    dto.type = entity.type as AlertRuleType;
    dto.isActive = entity.isActive;
    dto.rules = entity.rules as unknown as AlertRulePayload;
    dto.lastTriggeredAt = entity.lastTriggeredAt;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
