import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppException } from '../../common/exceptions/app-exception';
import { FamilyProfilesRepository } from '../family-profiles/family-profiles.repository';
import { USER_CLEANUP_QUEUE } from './user-cleanup.constants';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const USER_CLEANUP_QUEUE_TOKEN = `BullQueue_${USER_CLEANUP_QUEUE}`;

function fakeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'u-target',
    email: 'target@example.com',
    phone: null,
    passwordHash: 'hash',
    name: 'Target',
    locale: 'es',
    roles: ['user'],
    prefersVegan: false,
    prefersVegetarian: false,
    prefersGlutenFree: false,
    prefersLactoseFree: false,
    sortUnitPreference: 'absolute',
    nutriSortEnabled: false,
    nutriHealthyOnly: false,
    cookiesAcceptedAt: null,
    cookieConsentLevel: null,
    hardDeleteScheduledAt: null,
    emailVerifiedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    ...overrides,
  };
}

describe('UsersService.adminCancelDelete', () => {
  let service: UsersService;
  let repoMock: {
    findById: jest.Mock;
    findByIdIgnoreDeleted: jest.Mock;
    reactivate: jest.Mock;
    update: jest.Mock;
    exportUserData: jest.Mock;
    softDeleteWithRevoke: jest.Mock;
  };

  beforeEach(async () => {
    repoMock = {
      findById: jest.fn(),
      findByIdIgnoreDeleted: jest.fn(),
      reactivate: jest.fn(),
      update: jest.fn(),
      exportUserData: jest.fn(),
      softDeleteWithRevoke: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repoMock },
        { provide: USER_CLEANUP_QUEUE_TOKEN, useValue: { add: jest.fn() } },
        {
          provide: FamilyProfilesRepository,
          useValue: {
            findByUser: jest.fn().mockResolvedValue(null),
            updateRestrictions: jest.fn(),
          },
        },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('NOT_FOUND quando user não existe', async () => {
    repoMock.findByIdIgnoreDeleted.mockResolvedValue(null);
    const err = await service.adminCancelDelete('admin-1', 'ghost').catch((e) => e);
    expect(err).toBeInstanceOf(AppException);
    expect(err.errorCode).toBe('USERS.NOT_FOUND');
    expect((err as AppException).getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  it('reativa user soft-deleted dentro da janela', async () => {
    const soft = fakeUser({
      deletedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      hardDeleteScheduledAt: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
    });
    repoMock.findByIdIgnoreDeleted.mockResolvedValue(soft);
    repoMock.reactivate.mockResolvedValue(fakeUser({ deletedAt: null }));

    const result = await service.adminCancelDelete('admin-1', 'u-target');
    expect(repoMock.reactivate).toHaveBeenCalledWith('u-target');
    expect(result.status).toBe('reactivated');
    expect(result.user.id).toBe('u-target');
  });

  it('idempotente: user já ativo retorna already_active sem reativar', async () => {
    const active = fakeUser({ deletedAt: null });
    repoMock.findByIdIgnoreDeleted.mockResolvedValue(active);

    const result = await service.adminCancelDelete('admin-1', 'u-target');
    expect(repoMock.reactivate).not.toHaveBeenCalled();
    expect(result.status).toBe('already_active');
    expect(result.user.id).toBe('u-target');
  });
});
