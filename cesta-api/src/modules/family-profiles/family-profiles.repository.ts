import { Injectable } from '@nestjs/common';
import { DietaryQuestion, FamilyProfile, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FamilyProfilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listQuestions(): Promise<DietaryQuestion[]> {
    return this.prisma.dietaryQuestion.findMany({
      orderBy: [{ order: 'asc' }, { key: 'asc' }],
    });
  }

  findByUser(userId: string): Promise<FamilyProfile | null> {
    return this.prisma.familyProfile.findUnique({ where: { userId } });
  }

  upsert(
    userId: string,
    data: Omit<Prisma.FamilyProfileUncheckedCreateInput, 'userId'>,
  ): Promise<FamilyProfile> {
    return this.prisma.familyProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }
}
