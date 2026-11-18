import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService (Sprint 104)', () => {
  let service: AuditService;
  let prismaMock: {
    auditLog: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(AuditService);
  });

  describe('record', () => {
    it('cria row com type/userId/actorId/metadata', async () => {
      prismaMock.auditLog.create.mockResolvedValue({ id: 'x' });
      await service.record({
        type: 'UserDataExported',
        userId: 'u1',
        metadata: { bytes: 42 },
      });
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: {
          type: 'UserDataExported',
          userId: 'u1',
          actorId: null,
          metadata: { bytes: 42 },
        },
      });
    });

    it('swallow error de DB (não bloqueia fluxo principal)', async () => {
      prismaMock.auditLog.create.mockRejectedValue(new Error('db down'));
      await expect(
        service.record({ type: 'SecretRotated' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('parseTypes', () => {
    it('vazio/undefined → [] (sem filtro)', () => {
      expect(service.parseTypes()).toEqual([]);
      expect(service.parseTypes('')).toEqual([]);
      expect(service.parseTypes('   ')).toEqual([]);
    });

    it('CSV válido → array tipado', () => {
      expect(
        service.parseTypes('UserReactivated,SecretRotated'),
      ).toEqual(['UserReactivated', 'SecretRotated']);
    });

    it('CSV com valor fora da whitelist → throws', () => {
      expect(() => service.parseTypes('UserReactivated,FooBar')).toThrow(
        /invalid audit types: FooBar/,
      );
    });

    it('trim whitespace entre itens', () => {
      expect(
        service.parseTypes(' UserReactivated , SecretRotated '),
      ).toEqual(['UserReactivated', 'SecretRotated']);
    });
  });

  describe('list', () => {
    it('sem type filter → where vazio', async () => {
      prismaMock.$transaction.mockResolvedValue([[], 0]);
      prismaMock.auditLog.findMany.mockReturnValue('findMany-stub');
      prismaMock.auditLog.count.mockReturnValue('count-stub');
      await service.list(50, 0);
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          take: 50,
          skip: 0,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(prismaMock.auditLog.count).toHaveBeenCalledWith({ where: {} });
    });

    it('com type filter → where { type: { in: [...] } }', async () => {
      prismaMock.$transaction.mockResolvedValue([[], 0]);
      await service.list(10, 20, 'UserReactivated,SecretRotated');
      const expectedWhere = {
        type: { in: ['UserReactivated', 'SecretRotated'] },
      };
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere, take: 10, skip: 20 }),
      );
      expect(prismaMock.auditLog.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });

    it('propaga erro do parseTypes em type inválido', async () => {
      await expect(service.list(50, 0, 'FooBar')).rejects.toThrow(
        /invalid audit types/,
      );
    });
  });
});
