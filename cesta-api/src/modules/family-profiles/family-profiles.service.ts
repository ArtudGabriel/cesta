import { Injectable, NotFoundException } from '@nestjs/common';
import { FamilyProfile, Prisma } from '@prisma/client';
import { DietaryQuestionDto } from './dtos/dietary-question.dto';
import {
  FamilyProfileResponseDto,
  UpsertFamilyProfileDto,
} from './dtos/family-profile.dto';
import { FamilyProfilesRepository } from './family-profiles.repository';

@Injectable()
export class FamilyProfilesService {
  constructor(private readonly repo: FamilyProfilesRepository) {}

  async listQuestions(): Promise<DietaryQuestionDto[]> {
    const items = await this.repo.listQuestions();
    return items.map(DietaryQuestionDto.fromEntity);
  }

  async findMine(userId: string): Promise<FamilyProfileResponseDto | null> {
    const profile = await this.repo.findByUser(userId);
    return profile ? FamilyProfileResponseDto.fromEntity(profile) : null;
  }

  async getOrThrow(userId: string): Promise<FamilyProfile> {
    const profile = await this.repo.findByUser(userId);
    if (!profile) throw new NotFoundException('Perfil familiar não encontrado');
    return profile;
  }

  async upsertMine(
    userId: string,
    dto: UpsertFamilyProfileDto,
  ): Promise<FamilyProfileResponseDto> {
    const profile = await this.repo.upsert(userId, {
      members: dto.members as unknown as Prisma.InputJsonValue,
      answers: dto.answers as unknown as Prisma.InputJsonValue,
      restrictions: dto.restrictions ?? [],
      blockedCategories: dto.blockedCategories ?? [],
      requiredProductIds: dto.requiredProductIds ?? [],
    });
    return FamilyProfileResponseDto.fromEntity(profile);
  }
}
