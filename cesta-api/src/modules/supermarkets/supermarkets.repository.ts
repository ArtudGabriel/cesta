import { Injectable } from '@nestjs/common';
import { Supermarket } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SupermarketsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Supermarket[]> {
    return this.prisma.supermarket.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  findBySlug(slug: string): Promise<Supermarket | null> {
    return this.prisma.supermarket.findUnique({ where: { slug } });
  }

  findById(id: string): Promise<Supermarket | null> {
    return this.prisma.supermarket.findUnique({ where: { id } });
  }
}
