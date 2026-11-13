import { Injectable } from '@nestjs/common';
import {
  SearchHistoryRepository,
  SearchHistoryRow,
} from './search-history.repository';

const CAP = 10;

export interface SearchHistoryItem {
  id: string;
  query: string;
  createdAt: Date;
}

@Injectable()
export class SearchHistoryService {
  constructor(private readonly repo: SearchHistoryRepository) {}

  async list(userId: string): Promise<SearchHistoryItem[]> {
    const rows = await this.repo.listRecent(userId, CAP);
    return rows.map(toItem);
  }

  /**
   * Adiciona query no histórico. Se já existir (dedupe por userId+query),
   * atualiza createdAt pra MRU. Caps em 10 — remove mais antigos no overflow.
   * Retorna { item, created: boolean } pra controller decidir 201 vs 200.
   */
  async add(
    userId: string,
    query: string,
  ): Promise<{ item: SearchHistoryItem; created: boolean }> {
    const existing = await this.repo.findByQuery(userId, query);
    if (existing) {
      const touched = await this.repo.touch(existing.id);
      return { item: toItem(touched), created: false };
    }
    const row = await this.repo.create(userId, query);
    await this.repo.deleteOldestBeyondCap(userId, CAP);
    return { item: toItem(row), created: true };
  }

  async removeByQuery(userId: string, query: string): Promise<void> {
    await this.repo.deleteByQuery(userId, query);
  }

  async clearAll(userId: string): Promise<void> {
    await this.repo.deleteAll(userId);
  }
}

function toItem(row: SearchHistoryRow): SearchHistoryItem {
  return { id: row.id, query: row.query, createdAt: row.createdAt };
}
