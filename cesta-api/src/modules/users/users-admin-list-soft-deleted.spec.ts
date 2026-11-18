import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { FamilyProfilesRepository } from '../family-profiles/family-profiles.repository';
import { USER_CLEANUP_QUEUE } from './user-cleanup.constants';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const USER_CLEANUP_QUEUE_TOKEN = `BullQueue_${USER_CLEANUP_QUEUE}`;

function softDeletedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'u-1',
    email: 't1@example.com',
    phone: null,
    passwordHash: 'h',
    name: 'T1',
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
    hardDeleteScheduledAt: new Date('2026-12-01'),
    emailVerifiedAt: null,
    graceReminderSentAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-11-01'),
    deletedAt: new Date('2026-11-01'),
    ...overrides,
  };
}

describe('UsersService.adminListSoftDeleted', () => {
  let service: UsersService;
  let repoMock: {
    listSoftDeleted: jest.Mock;
  };

  beforeEach(async () => {
    repoMock = { listSoftDeleted: jest.fn() };
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
        {
          provide: AuditService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('projeta items soft-deleted no contrato público (id,email,deletedAt,graceEndsAt) + total', async () => {
    const a = softDeletedRow({ id: 'u-a', email: 'a@x.com' });
    const b = softDeletedRow({ id: 'u-b', email: 'b@x.com' });
    repoMock.listSoftDeleted.mockResolvedValue({ items: [a, b], total: 2 });

    const result = await service.adminListSoftDeleted(50, 0);
    expect(repoMock.listSoftDeleted).toHaveBeenCalledWith(50, 0);
    expect(result.total).toBe(2);
    expect(result.items).toEqual([
      {
        id: 'u-a',
        email: 'a@x.com',
        deletedAt: a.deletedAt,
        graceEndsAt: a.hardDeleteScheduledAt,
      },
      {
        id: 'u-b',
        email: 'b@x.com',
        deletedAt: b.deletedAt,
        graceEndsAt: b.hardDeleteScheduledAt,
      },
    ]);
    // Sanidade: jamais vaza passwordHash/phone pro contrato público.
    for (const item of result.items) {
      expect(Object.keys(item).sort()).toEqual(
        ['deletedAt', 'email', 'graceEndsAt', 'id'].sort(),
      );
    }
  });

  it('empty list → items=[] e total=0', async () => {
    repoMock.listSoftDeleted.mockResolvedValue({ items: [], total: 0 });
    const result = await service.adminListSoftDeleted(50, 0);
    expect(result).toEqual({ items: [], total: 0 });
  });
});
