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
});
