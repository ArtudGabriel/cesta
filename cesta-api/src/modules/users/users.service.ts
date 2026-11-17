import { InjectQueue } from '@nestjs/bullmq';
import {
  forwardRef,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { Queue } from 'bullmq';
import * as Sentry from '@sentry/node';
import { AppException } from '../../common/exceptions/app-exception';
import { buildExportZip, ExportZip } from './users-export.util';
import {
  DIETARY_KEYS,
  mergeRestrictions,
  prefsToRestrictionsSet,
} from '../../common/utils/dietary-sync';
import { FamilyProfilesRepository } from '../family-profiles/family-profiles.repository';
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
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    @InjectQueue(USER_CLEANUP_QUEUE)
    private readonly userCleanupQueue: Queue<HardDeleteJob>,
    // Sprint 65 bidirectional sync: forwardRef pra quebrar cycle com
    // FamilyProfilesService. Usa Repository direto (não Service) nos writes
    // pra evitar recursão service-to-service.
    @Inject(forwardRef(() => FamilyProfilesRepository))
    private readonly familyProfilesRepository: FamilyProfilesRepository,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new AppException(
        'USERS.NOT_FOUND',
        `User "${id}" not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findByPhone(phone);
  }

  async findByEmailIncludingDeleted(email: string): Promise<User | null> {
    return this.usersRepository.findByEmailIncludingDeleted(email);
  }

  async findByPhoneIncludingDeleted(phone: string): Promise<User | null> {
    return this.usersRepository.findByPhoneIncludingDeleted(phone);
  }

  async reactivateUser(userId: string): Promise<User> {
    return this.usersRepository.reactivate(userId);
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

    // Sprint 65 bidirectional dietary sync: se qualquer prefers* mudou e
    // user tem FamilyProfile, propaga pro restrictions (merge preservando
    // non-dietary strings). Repository-level write evita recursão.
    const touchedDietary =
      dto.prefersVegan !== undefined ||
      dto.prefersVegetarian !== undefined ||
      dto.prefersGlutenFree !== undefined ||
      dto.prefersLactoseFree !== undefined;
    if (touchedDietary) {
      const familyProfile =
        await this.familyProfilesRepository.findByUser(userId);
      if (familyProfile) {
        const prefsSet = prefsToRestrictionsSet(updated);
        const merged = mergeRestrictions(
          familyProfile.restrictions ?? [],
          prefsSet,
        );
        await this.familyProfilesRepository.updateRestrictions(
          userId,
          merged,
        );
      }
    }

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
   * Sprint 91 GDPR Art. 20: ZIP multi-CSV portability (perfil, favoritos,
   * listas, alertas, reviews, expenses). UTF-8 BOM em cada CSV pra Excel.
   * Nunca inclui passwordHash nem refreshTokens. Audit UserDataExported via
   * Sentry breadcrumb + log estruturado.
   */
  async exportMyData(userId: string): Promise<ExportZip> {
    const row = await this.usersRepository.exportUserData(userId);
    if (!row) {
      throw new AppException(
        'USERS.NOT_FOUND',
        `User "${userId}" not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    const {
      passwordHash: _passwordHash,
      deletedAt: _deletedAt,
      ...user
    } = row;

    const result = await buildExportZip(user as unknown as Record<string, unknown>);

    Sentry.addBreadcrumb({
      category: 'audit',
      level: 'info',
      message: 'UserDataExported',
      data: { userId, bytes: result.zip.length, files: result.files.length },
    });
    this.logger.log(
      `[audit] UserDataExported userId=${userId} bytes=${result.zip.length} files=${result.files.length}`,
    );

    return result;
  }

  /**
   * Sprint 95: lista paginada de users soft-deleted pro admin UI. Projeta
   * apenas id+email+deletedAt+graceEndsAt (hardDeleteScheduledAt renomeado
   * pro contrato público) — nunca exporta passwordHash nem phone.
   */
  async adminListSoftDeleted(
    limit: number,
    offset: number,
  ): Promise<{
    items: Array<{
      id: string;
      email: string | null;
      deletedAt: Date;
      graceEndsAt: Date | null;
    }>;
    total: number;
  }> {
    const { items, total } = await this.usersRepository.listSoftDeleted(
      limit,
      offset,
    );
    return {
      items: items.map((u) => ({
        id: u.id,
        email: u.email,
        deletedAt: u.deletedAt as Date,
        graceEndsAt: u.hardDeleteScheduledAt,
      })),
      total,
    };
  }

  /**
   * Sprint 92: admin cancela soft-delete de um user. Idempotente — user já
   * ativo retorna status=already_active sem efeito colateral. Audit
   * AdminCancelledDelete via Sentry breadcrumb + log estruturado.
   * O worker user-cleanup já aborta em user.deletedAt=null, então o job
   * BullMQ pendente de 30d fica inofensivo (não precisa remover).
   */
  async adminCancelDelete(
    adminId: string,
    userId: string,
  ): Promise<{ status: 'reactivated' | 'already_active'; user: UserResponseDto }> {
    const user = await this.usersRepository.findByIdIgnoreDeleted(userId);
    if (!user) {
      throw new AppException(
        'USERS.NOT_FOUND',
        `User "${userId}" not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (!user.deletedAt) {
      Sentry.addBreadcrumb({
        category: 'audit',
        level: 'info',
        message: 'AdminCancelledDelete',
        data: { adminId, userId, status: 'already_active' },
      });
      this.logger.log(
        `[audit] AdminCancelledDelete adminId=${adminId} userId=${userId} status=already_active`,
      );
      return {
        status: 'already_active',
        user: UserResponseDto.fromEntity(user),
      };
    }

    const reactivated = await this.usersRepository.reactivate(userId);
    Sentry.addBreadcrumb({
      category: 'audit',
      level: 'info',
      message: 'AdminCancelledDelete',
      data: { adminId, userId, status: 'reactivated' },
    });
    this.logger.log(
      `[audit] AdminCancelledDelete adminId=${adminId} userId=${userId} status=reactivated`,
    );
    return {
      status: 'reactivated',
      user: UserResponseDto.fromEntity(reactivated),
    };
  }

  /**
   * Sprint 63 GDPR Art. 17: soft-delete + revoke refresh tokens + zera
   * consent. User que chama DELETE na própria conta já estava autenticado,
   * então o guard garante que só o dono dispara.
   *
   * Sprint 94 follow-up: BullMQ enqueue é fire-and-forget pra não bloquear
   * resposta HTTP. Redis lento/indisponível causava timeout 45s pro frontend
   * mesmo com soft-delete já persistido. GDPR Art.17 é cumprido no momento
   * do soft-delete (deletedAt + hardDeleteScheduledAt setados em transação);
   * o job BullMQ é apenas o trigger de limpeza em 30d. Se enqueue falhar,
   * hardDeleteScheduledAt no DB permite um scanner de reconciliação futuro
   * recuperar o cleanup. Falha é logada + Sentry pra alerting.
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
    void this.enqueueHardDeleteDetached(userId);
  }

  private async enqueueHardDeleteDetached(userId: string): Promise<void> {
    try {
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `hard-delete enqueue failed userId=${userId}: ${msg}`,
      );
      Sentry.captureException(err, {
        tags: { feature: 'hard-delete-enqueue' },
        extra: { userId },
      });
    }
  }
}
