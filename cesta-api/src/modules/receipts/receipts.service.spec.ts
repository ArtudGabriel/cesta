import { Test } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { ReceiptsRepository } from './receipts.repository';
import { RECEIPTS_QUEUE } from './receipts.queue';
import { AppException } from '../../common/exceptions/app-exception';

const RECEIPTS_QUEUE_TOKEN = `BullQueue_${RECEIPTS_QUEUE}`;

const fakeReceipt = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'r1',
  userId: 'u1',
  supermarketId: null,
  supermarketSlug: null,
  purchaseDate: null,
  total: 10,
  imageUrl: null,
  ocrRawText: null,
  status: 'ready',
  errorMessage: null,
  notes: null,
  createdAt: new Date('2026-11-18'),
  updatedAt: new Date('2026-11-18'),
  deletedAt: null,
  supermarket: null,
  items: [],
  ...overrides,
});

describe('ReceiptsService edit (S101)', () => {
  let service: ReceiptsService;
  let repoMock: {
    findByIdForUser: jest.Mock;
    findItemForUser: jest.Mock;
    updateMeta: jest.Mock;
    updateItemAndRecalc: jest.Mock;
    addItemAndRecalc: jest.Mock;
    removeItemAndRecalc: jest.Mock;
    softDelete: jest.Mock;
  };
  const queueMock = { add: jest.fn() };

  beforeEach(async () => {
    repoMock = {
      findByIdForUser: jest.fn(),
      findItemForUser: jest.fn(),
      updateMeta: jest.fn(),
      updateItemAndRecalc: jest.fn(),
      addItemAndRecalc: jest.fn(),
      removeItemAndRecalc: jest.fn(),
      softDelete: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        ReceiptsService,
        { provide: ReceiptsRepository, useValue: repoMock },
        { provide: RECEIPTS_QUEUE_TOKEN, useValue: queueMock },
      ],
    }).compile();
    service = module.get(ReceiptsService);
  });

  describe('updateItem (DoD G/W/T #1 PATCH recalc)', () => {
    it('owner edita qty+unitPrice → recalc via repo + returns updated receipt', async () => {
      repoMock.findItemForUser.mockResolvedValue({ id: 'i1', receiptId: 'r1' });
      repoMock.findByIdForUser.mockResolvedValue(fakeReceipt({ total: 20 }));

      await service.updateItem('u1', 'r1', 'i1', {
        quantity: 2,
        unitPrice: 10,
      });

      expect(repoMock.updateItemAndRecalc).toHaveBeenCalledWith('r1', 'i1', {
        quantity: 2,
        unitPrice: 10,
      });
    });

    it('item pertence a outra receipt do mesmo user → 403', async () => {
      repoMock.findItemForUser.mockResolvedValue({ id: 'i1', receiptId: 'OTHER' });
      await expect(
        service.updateItem('u1', 'r1', 'i1', { quantity: 1 }),
      ).rejects.toMatchObject({
        errorCode: 'RECEIPTS.ITEM_FORBIDDEN',
      });
      expect(repoMock.updateItemAndRecalc).not.toHaveBeenCalled();
    });
  });

  describe('removeItem (DoD #2 DELETE recalc)', () => {
    it('owner delete → 204 + recalc', async () => {
      repoMock.findByIdForUser.mockResolvedValue(fakeReceipt());
      await service.removeItem('u1', 'r1', 'i1');
      expect(repoMock.removeItemAndRecalc).toHaveBeenCalledWith('r1', 'i1');
    });

    it('non-owner → 403 forbidden', async () => {
      repoMock.findByIdForUser.mockResolvedValue(null);
      await expect(service.removeItem('u-other', 'r1', 'i1')).rejects.toMatchObject({
        errorCode: 'RECEIPTS.FORBIDDEN',
      });
      expect(repoMock.removeItemAndRecalc).not.toHaveBeenCalled();
    });
  });

  describe('addItem (DoD #3 POST manual)', () => {
    it('owner POST → 201 recalc', async () => {
      repoMock.findByIdForUser.mockResolvedValue(fakeReceipt());
      await service.addItem('u1', 'r1', {
        rawText: 'MAÇÃ KG',
        normalizedName: 'maca',
        quantity: 1.5,
        unitPrice: 2,
      });
      expect(repoMock.addItemAndRecalc).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({
          rawText: 'MAÇÃ KG',
          normalizedName: 'maca',
          quantity: 1.5,
          unitPrice: 2,
        }),
      );
    });
  });

  describe('updateMeta (DoD #4 PATCH receipt preserve items + #5 403)', () => {
    it('owner patch total+date+supermarket → repo recebe payload', async () => {
      repoMock.findByIdForUser.mockResolvedValue(fakeReceipt());
      await service.updateMeta('u1', 'r1', {
        supermarketSlug: 'mercadona',
        purchaseDate: new Date('2026-11-01'),
        total: 42.5,
      });
      expect(repoMock.updateMeta).toHaveBeenCalledWith('r1', {
        supermarketSlug: 'mercadona',
        purchaseDate: new Date('2026-11-01'),
        total: 42.5,
      });
    });

    it('non-owner PATCH → 403 forbidden, repo não chamado (DoD #5)', async () => {
      repoMock.findByIdForUser.mockResolvedValue(null);
      await expect(
        service.updateMeta('u-other', 'r1', { total: 99 }),
      ).rejects.toMatchObject({
        errorCode: 'RECEIPTS.FORBIDDEN',
      });
      expect(repoMock.updateMeta).not.toHaveBeenCalled();
    });
  });
});
