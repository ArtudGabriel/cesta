import { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app-exception';
import { ProductsRepository } from '../products/products.repository';
import { AlertsRepository } from './alerts.repository';
import { AlertsService } from './alerts.service';

/**
 * Sprint 105 — service-layer guards do createRule:
 *  - trial cap (403 ALERTS_RULES.TRIAL_CAP)
 *  - duplicate canonical key (409 ALERTS_RULES.DUPLICATE)
 *  - product not found (404 ALERTS_RULES.PRODUCT_NOT_FOUND)
 *  - invalid Zod payload (400 ALERTS_RULES.INVALID_PAYLOAD)
 */
describe('AlertsService.createRule (Sprint 105 guards)', () => {
  let service: AlertsService;
  let repo: {
    countActiveRulesByUser: jest.Mock;
    findActiveRulesByUserAndType: jest.Mock;
    createRule: jest.Mock;
  };
  let productsRepo: { findById: jest.Mock };
  let config: ConfigService;

  const cuid = (n: number) => `c${String(n).padStart(24, '0').slice(0, 24)}`;
  const P1 = cuid(1);
  const P2 = cuid(2);
  const P3 = cuid(3);

  function okProducts() {
    productsRepo.findById.mockImplementation(async (id: string) => ({
      id,
      name: `p-${id}`,
    }));
  }

  beforeEach(() => {
    repo = {
      countActiveRulesByUser: jest.fn().mockResolvedValue(0),
      findActiveRulesByUserAndType: jest.fn().mockResolvedValue([]),
      createRule: jest.fn().mockImplementation(async (data) => ({
        id: 'r-new',
        userId: data.userId,
        type: data.type,
        rules: data.rules,
        isActive: true,
        lastTriggeredAt: null,
        lastNotifiedAt: null,
        lastNotifiedHash: null,
        createdAt: new Date('2026-11-18T12:00:00Z'),
      })),
    };
    productsRepo = { findById: jest.fn() };
    config = {
      get: jest.fn((_key: string, fallback?: unknown) => fallback),
    } as unknown as ConfigService;

    service = new AlertsService(
      repo as unknown as AlertsRepository,
      productsRepo as unknown as ProductsRepository,
      config,
    );
    jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
  });

  it('combo válido + cap vazio + sem duplicate → cria regra', async () => {
    okProducts();

    const dto = await service.createRule('u1', 'combo', {
      productIds: [P1, P2],
      targetTotal: 5,
    });

    expect(dto.type).toBe('combo');
    expect(repo.createRule).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', type: 'combo' }),
    );
  });

  it('trial cap atingido (5 ativas) → 403 ALERTS_RULES.TRIAL_CAP', async () => {
    okProducts();
    repo.countActiveRulesByUser.mockResolvedValue(5);

    try {
      await service.createRule('u1', 'combo', {
        productIds: [P1, P2],
        targetTotal: 5,
      });
      fail('esperado AppException');
    } catch (err) {
      expect(err).toBeInstanceOf(AppException);
      expect((err as AppException).errorCode).toBe('ALERTS_RULES.TRIAL_CAP');
      expect((err as AppException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
    expect(repo.createRule).not.toHaveBeenCalled();
  });

  it('trial cap custom via ALERT_RULES_TRIAL_CAP env', async () => {
    okProducts();
    (config.get as jest.Mock).mockImplementation(
      (key: string, fallback?: unknown) =>
        key === 'ALERT_RULES_TRIAL_CAP' ? 2 : fallback,
    );
    repo.countActiveRulesByUser.mockResolvedValue(2);

    await expect(
      service.createRule('u1', 'combo', {
        productIds: [P1, P2],
        targetTotal: 5,
      }),
    ).rejects.toMatchObject({ errorCode: 'ALERTS_RULES.TRIAL_CAP' });
  });

  it('duplicate canonical key (mesmo type + productIds sorted + target) → 409', async () => {
    okProducts();
    repo.findActiveRulesByUserAndType.mockResolvedValue([
      {
        id: 'r-existing',
        rules: { productIds: [P2, P1], targetTotal: 5 }, // ordem diferente, canonical igual
      },
    ]);

    try {
      await service.createRule('u1', 'combo', {
        productIds: [P1, P2],
        targetTotal: 5,
      });
      fail('esperado AppException');
    } catch (err) {
      expect(err).toBeInstanceOf(AppException);
      expect((err as AppException).errorCode).toBe('ALERTS_RULES.DUPLICATE');
      expect((err as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
    }
    expect(repo.createRule).not.toHaveBeenCalled();
  });

  it('duplicate check ignora params diferentes (mesmo type, target diferente)', async () => {
    okProducts();
    repo.findActiveRulesByUserAndType.mockResolvedValue([
      { id: 'r-existing', rules: { productIds: [P1, P2], targetTotal: 8 } },
    ]);

    await expect(
      service.createRule('u1', 'combo', {
        productIds: [P1, P2],
        targetTotal: 5,
      }),
    ).resolves.toMatchObject({ type: 'combo' });
    expect(repo.createRule).toHaveBeenCalled();
  });

  it('productId inexistente → 404 ALERTS_RULES.PRODUCT_NOT_FOUND', async () => {
    productsRepo.findById.mockResolvedValue(null);

    await expect(
      service.createRule('u1', 'trend', { productId: P1, consecutiveWeeks: 3 }),
    ).rejects.toMatchObject({
      errorCode: 'ALERTS_RULES.PRODUCT_NOT_FOUND',
    });
  });

  it('payload Zod inválido (cuid malformado) → 400 INVALID_PAYLOAD', async () => {
    await expect(
      service.createRule('u1', 'combo', {
        productIds: ['not-a-cuid', P2],
        targetTotal: 5,
      }),
    ).rejects.toMatchObject({
      errorCode: 'ALERTS_RULES.INVALID_PAYLOAD',
    });
  });

  it('bundle: 3+ productIds + targetSavings → cria', async () => {
    okProducts();

    const dto = await service.createRule('u1', 'bundle', {
      productIds: [P1, P2, P3],
      targetSavings: 2.5,
    });

    expect(dto.type).toBe('bundle');
    expect(repo.createRule).toHaveBeenCalled();
  });

  it('listRules com type inválido → 400 INVALID_TYPE', async () => {
    await expect(
      service.listRules('u1', 'bogus'),
    ).rejects.toMatchObject({ errorCode: 'ALERTS_RULES.INVALID_TYPE' });
  });
});
