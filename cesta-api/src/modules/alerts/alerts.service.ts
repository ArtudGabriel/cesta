import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlertRule, Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppException } from '../../common/exceptions/app-exception';
import { ProductsRepository } from '../products/products.repository';
import { AlertsRepository } from './alerts.repository';
import {
  ALERT_RULE_TYPES,
  AlertRulePayload,
  AlertRuleResponseDto,
  AlertRuleType,
  canonicalKey,
  schemaFor,
} from './dtos/alert-rule.dto';
import { AlertResponseDto } from './dtos/alert-response.dto';
import { CreateAlertDto, UpdateAlertDto } from './dtos/create-alert.dto';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly repo: AlertsRepository,
    private readonly productsRepo: ProductsRepository,
    private readonly config: ConfigService,
  ) {}

  private get trialCap(): number {
    return this.config.get<number>('ALERT_RULES_TRIAL_CAP', 5);
  }

  async list(userId: string): Promise<AlertResponseDto[]> {
    const items = await this.repo.findAllByUser(userId);
    return items.map(AlertResponseDto.fromEntity);
  }

  async findOne(userId: string, id: string): Promise<AlertResponseDto> {
    const alert = await this.repo.findByIdForUser(id, userId);
    if (!alert)
      throw new AppException(
        'ALERTS.NOT_FOUND',
        `Alerta "${id}" não encontrado`,
        HttpStatus.NOT_FOUND,
      );
    return AlertResponseDto.fromEntity(alert);
  }

  async create(userId: string, dto: CreateAlertDto): Promise<AlertResponseDto> {
    if (dto.type === 'target_price' && !dto.targetPrice) {
      throw new AppException(
        'ALERTS.TARGET_PRICE_REQUIRED',
        'targetPrice é obrigatório para type=target_price',
        HttpStatus.BAD_REQUEST,
        { type: dto.type },
      );
    }

    const product = await this.productsRepo.findById(dto.productId);
    if (!product)
      throw new AppException(
        'ALERTS.PRODUCT_NOT_FOUND',
        'Produto não encontrado',
        HttpStatus.NOT_FOUND,
      );

    const alert = await this.repo.create({
      userId,
      productId: dto.productId,
      supermarketId: dto.supermarketId ?? null,
      type: dto.type,
      targetPrice:
        dto.targetPrice != null ? new Prisma.Decimal(dto.targetPrice) : null,
    });

    return AlertResponseDto.fromEntity(alert);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAlertDto,
  ): Promise<AlertResponseDto> {
    await this.assertOwner(userId, id);
    const updated = await this.repo.update(id, {
      isActive: dto.isActive,
      targetPrice:
        dto.targetPrice != null ? new Prisma.Decimal(dto.targetPrice) : undefined,
    });
    return AlertResponseDto.fromEntity(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwner(userId, id);
    await this.repo.softDelete(id);
  }

  private async assertOwner(userId: string, id: string): Promise<void> {
    const alert = await this.repo.findByIdForUser(id, userId);
    if (!alert)
      throw new AppException(
        'ALERTS.FORBIDDEN',
        'Alerta não acessível',
        HttpStatus.FORBIDDEN,
        { alertId: id },
      );
  }

  // ──────────────────────────────────────────────────────────────
  // Sprint 105 — AlertRule (combo / trend / bundle)
  // ──────────────────────────────────────────────────────────────

  async createRule(
    userId: string,
    type: AlertRuleType,
    rawBody: unknown,
  ): Promise<AlertRuleResponseDto> {
    const schema = schemaFor(type);
    const parsed = schema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppException(
        'ALERTS_RULES.INVALID_PAYLOAD',
        'Payload inválido para regra de alerta',
        HttpStatus.BAD_REQUEST,
        { type, issues: parsed.error.issues },
      );
    }
    const rules = parsed.data as AlertRulePayload;

    await this.assertProductsExist(this.extractProductIds(type, rules));

    const activeCount = await this.repo.countActiveRulesByUser(userId);
    if (activeCount >= this.trialCap) {
      throw new AppException(
        'ALERTS_RULES.TRIAL_CAP',
        `Limite de ${this.trialCap} regras ativas atingido`,
        HttpStatus.FORBIDDEN,
        { cap: this.trialCap },
      );
    }

    const key = canonicalKey(type, rules);
    const existing = await this.repo.findActiveRulesByUserAndType(userId, type);
    const dup = existing.find(
      (r) => canonicalKey(type, r.rules as unknown as AlertRulePayload) === key,
    );
    if (dup) {
      throw new AppException(
        'ALERTS_RULES.DUPLICATE',
        'Já existe uma regra ativa com os mesmos parâmetros',
        HttpStatus.CONFLICT,
        { ruleId: dup.id, type },
      );
    }

    const created = await this.repo.createRule({
      userId,
      type,
      rules: rules as unknown as Prisma.InputJsonValue,
    });
    this.logger.log(`[audit] AlertRuleCreated user=${userId} type=${type} id=${created.id}`);
    return AlertRuleResponseDto.fromEntity(created);
  }

  async listRules(
    userId: string,
    type?: string,
  ): Promise<AlertRuleResponseDto[]> {
    if (type && !ALERT_RULE_TYPES.includes(type as AlertRuleType)) {
      throw new AppException(
        'ALERTS_RULES.INVALID_TYPE',
        `type deve ser um de: ${ALERT_RULE_TYPES.join(', ')}`,
        HttpStatus.BAD_REQUEST,
        { type },
      );
    }
    const rows = await this.repo.findRulesByUser(userId, type);
    return rows.map(AlertRuleResponseDto.fromEntity);
  }

  private extractProductIds(
    type: AlertRuleType,
    rules: AlertRulePayload,
  ): string[] {
    if (type === 'trend') {
      return [(rules as { productId: string }).productId];
    }
    return [...(rules as { productIds: string[] }).productIds];
  }

  private async assertProductsExist(ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    for (const id of unique) {
      const product = await this.productsRepo.findById(id);
      if (!product) {
        throw new AppException(
          'ALERTS_RULES.PRODUCT_NOT_FOUND',
          'Produto não encontrado',
          HttpStatus.NOT_FOUND,
          { productId: id },
        );
      }
    }
  }
}

// Zod error → structured payload (type guard pra uso em handler se precisar)
export function isZodError(err: unknown): err is z.ZodError {
  return err instanceof z.ZodError;
}
