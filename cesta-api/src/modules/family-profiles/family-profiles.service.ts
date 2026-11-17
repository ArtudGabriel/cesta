import { HttpStatus, Injectable } from '@nestjs/common';
import { FamilyProfile, Prisma } from '@prisma/client';
import { AppException } from '../../common/exceptions/app-exception';
import { restrictionsToPrefs } from '../../common/utils/dietary-sync';
import { UsersRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { DietaryQuestionDto } from './dtos/dietary-question.dto';
import {
  FamilyProfileResponseDto,
  UpsertFamilyProfileDto,
} from './dtos/family-profile.dto';
import { FamilyProfilesRepository } from './family-profiles.repository';

const DIETARY_PREF_MAP: Record<string, string> = {
  prefersVegan: 'vegan',
  prefersVegetarian: 'vegetarian',
  prefersGlutenFree: 'glutenFree',
  prefersLactoseFree: 'lactoseFree',
};

@Injectable()
export class FamilyProfilesService {
  constructor(
    private readonly repo: FamilyProfilesRepository,
    private readonly usersService: UsersService,
    // Sprint 65 bidirectional sync: reverse propagation restrictions → user.prefers*
    // via Repository (não Service) pra evitar recursão.
    private readonly usersRepository: UsersRepository,
  ) {}

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
    if (!profile)
      throw new AppException(
        'FAMILY_PROFILE.NOT_FOUND',
        'Perfil familiar não encontrado',
        HttpStatus.NOT_FOUND,
      );
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
      monthlyBudget:
        dto.monthlyBudget != null
          ? new Prisma.Decimal(dto.monthlyBudget)
          : null,
    });
    // Sprint 65 bidirectional sync: restrictions do wizard → user.prefers*.
    // Mirror exato dos 4 dietary strings conhecidos (restrições extra do
    // wizard ex: 'kosher' ficam só em FamilyProfile).
    await this.usersRepository.update(
      userId,
      restrictionsToPrefs(profile.restrictions ?? []),
    );
    return FamilyProfileResponseDto.fromEntity(profile);
  }

  /**
   * Sync das prefs dietéticas do user (prefers*) pro FamilyProfile.restrictions.
   * Merge union — preserva restrictions existentes do wizard (ex: 'sin-azucar')
   * que não sejam dietary primárias. Idempotente se user sem prefs ativos.
   */
  async syncDietaryFromUser(
    userId: string,
  ): Promise<FamilyProfileResponseDto> {
    const familyProfile = await this.repo.findByUser(userId);
    if (!familyProfile) {
      throw new AppException(
        'FAMILY_PROFILE.NOT_FOUND',
        'Perfil familiar não encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    const user = await this.usersService.findById(userId);
    const userDietary: string[] = [];
    for (const [key, mapped] of Object.entries(DIETARY_PREF_MAP)) {
      if ((user as unknown as Record<string, boolean>)[key]) {
        userDietary.push(mapped);
      }
    }

    const merged = Array.from(
      new Set([...(familyProfile.restrictions ?? []), ...userDietary]),
    );

    const updated = await this.repo.updateRestrictions(userId, merged);
    return FamilyProfileResponseDto.fromEntity(updated);
  }
}
