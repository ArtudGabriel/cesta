import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { Queue } from 'bullmq';
import { AppException } from '../../common/exceptions/app-exception';
import type { CookieConsentLevel } from './dtos/consent.dto';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UserResponseDto } from './dtos/user-response.dto';
import {
  HardDeleteJob,
  USER_CLEANUP_QUEUE,
} from './user-cleanup.constants';
import { UsersRepository } from './users.repository';

const HARD_DELETE_DELAY_MS = 30 * 24 * 60 * 60 * 1000;

export interface CreateUserInput {
  email?: string;
  phone?: string;
  passwordHash: string;
  name?: string;
  locale?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    @InjectQueue(USER_CLEANUP_QUEUE)
    private readonly userCleanupQueue: Queue<HardDeleteJob>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User "${id}" not found`);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findByPhone(phone);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    if (!input.email && !input.phone) {
      throw new AppException(
        'AUTH.CONTACT_REQUIRED',
        'Email ou telefone é obrigatório',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (input.email) {
      const existing = await this.usersRepository.findByEmail(input.email);
      if (existing)
        throw new AppException(
          'AUTH.USER_EXISTS',
          'Email já cadastrado',
          HttpStatus.CONFLICT,
        );
    }
    if (input.phone) {
      const existing = await this.usersRepository.findByPhone(input.phone);
      if (existing)
        throw new AppException(
          'AUTH.USER_EXISTS',
          'Telefone já cadastrado',
          HttpStatus.CONFLICT,
        );
    }

    return this.usersRepository.create({
      email: input.email ?? null,
      phone: input.phone ?? null,
      passwordHash: input.passwordHash,
      name: input.name ?? null,
      locale: input.locale ?? 'es',
    });
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.locale !== undefined) data.locale = dto.locale;
    if (dto.prefersVegan !== undefined) data.prefersVegan = dto.prefersVegan;
    if (dto.prefersVegetarian !== undefined)
      data.prefersVegetarian = dto.prefersVegetarian;
    if (dto.prefersGlutenFree !== undefined)
      data.prefersGlutenFree = dto.prefersGlutenFree;
    if (dto.prefersLactoseFree !== undefined)
      data.prefersLactoseFree = dto.prefersLactoseFree;
    if (dto.sortUnitPreference !== undefined)
      data.sortUnitPreference = dto.sortUnitPreference;
    if (dto.nutriSortEnabled !== undefined)
      data.nutriSortEnabled = dto.nutriSortEnabled;
    if (dto.nutriHealthyOnly !== undefined)
      data.nutriHealthyOnly = dto.nutriHealthyOnly;

    if (Object.keys(data).length === 0) {
      const current = await this.findById(userId);
      return UserResponseDto.fromEntity(current);
    }

    const updated = await this.usersRepository.update(userId, data);
    return UserResponseDto.fromEntity(updated);
  }

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.findById(userId);
    return UserResponseDto.fromEntity(user);
  }

  async saveConsent(
    userId: string,
    level: CookieConsentLevel,
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      cookieConsentLevel: level,
      cookiesAcceptedAt: new Date(),
    });
  }

  /**
   * Sprint 63 GDPR Art. 20: agrega todas as entidades per-user num payload
   * de export. Nunca inclui passwordHash nem refreshTokens (privilegiados).
   */
  async exportMyData(userId: string): Promise<Record<string, unknown>> {
    const row = await this.usersRepository.exportUserData(userId);
    if (!row) {
      throw new NotFoundException(`User "${userId}" not found`);
    }
    const {
      passwordHash: _passwordHash,
      deletedAt: _deletedAt,
      ...user
    } = row;
    return {
      exportedAt: new Date().toISOString(),
      user,
    };
  }

  /**
   * Sprint 63 GDPR Art. 17: soft-delete + revoke refresh tokens + zera
   * consent. User que chama DELETE na própria conta já estava autenticado,
   * então o guard garante que só o dono dispara.
   */
  async deleteMyAccount(userId: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new AppException(
        'USERS.ALREADY_DELETED',
        'Conta já excluída',
        HttpStatus.GONE,
      );
    }
    await this.usersRepository.softDeleteWithRevoke(userId);
    // Sprint 64 GDPR Art.17: enqueue hard-delete 30d após soft-delete.
    // Queue delay + job attempts + exponential backoff cobrem flakes transient.
    await this.userCleanupQueue.add(
      'hard-delete',
      { userId },
      {
        delay: HARD_DELETE_DELAY_MS,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }
}
