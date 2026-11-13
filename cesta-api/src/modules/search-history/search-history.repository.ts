import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface SearchHistoryRow {
  id: string;
  userId: string;
  query: string;
  createdAt: Date;
}

@Injectable()
export class SearchHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  listRecent(userId: string, limit = 10): Promise<SearchHistoryRow[]> {
    return this.prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  findByQuery(
    userId: string,
    query: string,
  ): Promise<SearchHistoryRow | null> {
    return this.prisma.searchHistory.findUnique({
      where: { userId_query: { userId, query } },
    });
  }

  create(userId: string, query: string): Promise<SearchHistoryRow> {
    return this.prisma.searchHistory.create({
      data: { userId, query },
    });
  }

  touch(id: string): Promise<SearchHistoryRow> {
    return this.prisma.searchHistory.update({
      where: { id },
      data: { createdAt: new Date() },
    });
  }

  async deleteByQuery(userId: string, query: string): Promise<void> {
    await this.prisma.searchHistory.deleteMany({
      where: { userId, query },
    });
  }

  async deleteAll(userId: string): Promise<void> {
    await this.prisma.searchHistory.deleteMany({ where: { userId } });
  }

  async deleteOldestBeyondCap(userId: string, cap: number): Promise<void> {
    const overflow = await this.prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: cap,
      select: { id: true },
    });
    if (overflow.length === 0) return;
    await this.prisma.searchHistory.deleteMany({
      where: { id: { in: overflow.map((o) => o.id) } },
    });
  }
}
