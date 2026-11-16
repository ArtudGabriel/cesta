import { Test } from '@nestjs/testing';
import { SearchHistoryRepository } from './search-history.repository';
import { SearchHistoryService } from './search-history.service';

describe('SearchHistoryService', () => {
  let service: SearchHistoryService;
  let repo: {
    listRecent: jest.Mock;
    findByQuery: jest.Mock;
    create: jest.Mock;
    touch: jest.Mock;
    deleteByQuery: jest.Mock;
    deleteAll: jest.Mock;
    deleteOldestBeyondCap: jest.Mock;
  };

  const fakeRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'sh1',
    userId: 'u1',
    query: 'aceite',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    repo = {
      listRecent: jest.fn(),
      findByQuery: jest.fn(),
      create: jest.fn(),
      touch: jest.fn(),
      deleteByQuery: jest.fn(),
      deleteAll: jest.fn(),
      deleteOldestBeyondCap: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        SearchHistoryService,
        { provide: SearchHistoryRepository, useValue: repo },
      ],
    }).compile();
    service = module.get(SearchHistoryService);
  });

  it('add novo query cria + dispara cap check', async () => {
    repo.findByQuery.mockResolvedValue(null);
    repo.create.mockResolvedValue(fakeRow({ query: 'pasta' }));
    repo.deleteOldestBeyondCap.mockResolvedValue(undefined);

    const result = await service.add('u1', 'pasta');

    expect(repo.create).toHaveBeenCalledWith('u1', 'pasta');
    expect(repo.deleteOldestBeyondCap).toHaveBeenCalledWith('u1', 10);
    expect(result.created).toBe(true);
    expect(result.item.query).toBe('pasta');
  });

  it('add duplicate atualiza createdAt (MRU) sem criar', async () => {
    const existing = fakeRow({ id: 'sh-old', query: 'aceite' });
    repo.findByQuery.mockResolvedValue(existing);
    repo.touch.mockResolvedValue({ ...existing, createdAt: new Date() });

    const result = await service.add('u1', 'aceite');

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.touch).toHaveBeenCalledWith('sh-old');
    expect(result.created).toBe(false);
    expect(result.item.id).toBe('sh-old');
  });

  it('cap 10: deleteOldestBeyondCap chamado a cada add novo', async () => {
    repo.findByQuery.mockResolvedValue(null);
    repo.create.mockResolvedValue(fakeRow({ query: '11th' }));
    repo.deleteOldestBeyondCap.mockResolvedValue(undefined);

    await service.add('u1', '11th');

    expect(repo.deleteOldestBeyondCap).toHaveBeenCalledWith('u1', 10);
  });

  it('clearAll chama repo.deleteAll', async () => {
    repo.deleteAll.mockResolvedValue(undefined);

    await service.clearAll('u1');

    expect(repo.deleteAll).toHaveBeenCalledWith('u1');
  });

  describe('sync (Sprint 81)', () => {
    it('cria faltantes e touch existentes, dedup case-insensitive', async () => {
      repo.findByQuery.mockImplementation((_u, q) =>
        Promise.resolve(q === 'leche' ? fakeRow({ id: 'sh-leche', query: 'leche' }) : null),
      );
      repo.create.mockResolvedValue(fakeRow({ id: 'sh-new', query: 'aceite' }));
      repo.touch.mockResolvedValue(fakeRow({ id: 'sh-leche', query: 'leche' }));
      repo.deleteOldestBeyondCap.mockResolvedValue(undefined);
      repo.listRecent.mockResolvedValue([
        fakeRow({ id: 'sh-new', query: 'aceite' }),
        fakeRow({ id: 'sh-leche', query: 'leche' }),
      ]);

      const result = await service.sync('u1', ['aceite', 'ACEITE', 'leche']);

      expect(repo.create).toHaveBeenCalledTimes(1);
      expect(repo.create).toHaveBeenCalledWith('u1', 'aceite');
      expect(repo.touch).toHaveBeenCalledWith('sh-leche');
      expect(repo.deleteOldestBeyondCap).toHaveBeenCalledWith('u1', 10);
      expect(result.map((i) => i.query)).toEqual(['aceite', 'leche']);
    });

    it('array vazio não chama repo nem cap', async () => {
      repo.listRecent.mockResolvedValue([]);

      const result = await service.sync('u1', []);

      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.touch).not.toHaveBeenCalled();
      expect(repo.deleteOldestBeyondCap).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('insere do mais antigo pro mais novo (reverse) pra MRU correto', async () => {
      // Cliente envia ["aceite", "leche"] onde aceite é o mais recente.
      // Service reverte, insere leche primeiro depois aceite, deixando aceite no topo MRU.
      repo.findByQuery.mockResolvedValue(null);
      repo.create.mockResolvedValue(fakeRow());
      repo.deleteOldestBeyondCap.mockResolvedValue(undefined);
      repo.listRecent.mockResolvedValue([]);

      await service.sync('u1', ['aceite', 'leche']);

      expect(repo.create.mock.calls.map((c) => c[1])).toEqual(['leche', 'aceite']);
    });
  });
});
