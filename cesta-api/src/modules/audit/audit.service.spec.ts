import { Test } from '@nestjs/testing';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

describe('AuditService (Sprint 104)', () => {
  let service: AuditService;
  let repoMock: { create: jest.Mock; listAndCount: jest.Mock };

  beforeEach(async () => {
    repoMock = { create: jest.fn(), listAndCount: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: AuditRepository, useValue: repoMock },
      ],
    }).compile();
    service = module.get(AuditService);
  });

  describe('record', () => {
    it('chama repo.create com type/userId/actorId/metadata', async () => {
      repoMock.create.mockResolvedValue(undefined);
      await service.record({
        type: 'UserDataExported',
        userId: 'u1',
        metadata: { bytes: 42 },
      });
      expect(repoMock.create).toHaveBeenCalledWith({
        type: 'UserDataExported',
        userId: 'u1',
        actorId: null,
        metadata: { bytes: 42 },
      });
    });

    it('swallow error do repo (não bloqueia fluxo principal)', async () => {
      repoMock.create.mockRejectedValue(new Error('db down'));
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
      repoMock.listAndCount.mockResolvedValue({ items: [], total: 0 });
      await service.list(50, 0);
      expect(repoMock.listAndCount).toHaveBeenCalledWith({}, 50, 0);
    });

    it('com type filter → where { type: { in: [...] } }', async () => {
      repoMock.listAndCount.mockResolvedValue({ items: [], total: 0 });
      await service.list(10, 20, 'UserReactivated,SecretRotated');
      expect(repoMock.listAndCount).toHaveBeenCalledWith(
        { type: { in: ['UserReactivated', 'SecretRotated'] } },
        10,
        20,
      );
    });

    it('propaga erro do parseTypes em type inválido', async () => {
      await expect(service.list(50, 0, 'FooBar')).rejects.toThrow(
        /invalid audit types/,
      );
    });
  });
});
