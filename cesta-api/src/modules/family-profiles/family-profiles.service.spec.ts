import { Test } from '@nestjs/testing';
import { AppException } from '../../common/exceptions/app-exception';
import { UsersService } from '../users/users.service';
import { FamilyProfilesRepository } from './family-profiles.repository';
import { FamilyProfilesService } from './family-profiles.service';

describe('FamilyProfilesService.syncDietaryFromUser', () => {
  let service: FamilyProfilesService;
  let repo: {
    findByUser: jest.Mock;
    updateRestrictions: jest.Mock;
    upsert: jest.Mock;
    listQuestions: jest.Mock;
  };
  let usersService: { findById: jest.Mock };

  const fakeUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'u1',
    prefersVegan: false,
    prefersVegetarian: false,
    prefersGlutenFree: false,
    prefersLactoseFree: false,
    ...overrides,
  });

  const fakeFamily = (restrictions: string[] = []) => ({
    id: 'fp1',
    userId: 'u1',
    members: {},
    answers: {},
    restrictions,
    blockedCategories: [],
    requiredProductIds: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  });

  beforeEach(async () => {
    repo = {
      findByUser: jest.fn(),
      updateRestrictions: jest.fn(),
      upsert: jest.fn(),
      listQuestions: jest.fn(),
    };
    usersService = { findById: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        FamilyProfilesService,
        { provide: FamilyProfilesRepository, useValue: repo },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();
    service = module.get(FamilyProfilesService);
  });

  it('user sem FamilyProfile → throw FAMILY_PROFILE.NOT_FOUND', async () => {
    repo.findByUser.mockResolvedValue(null);

    await expect(service.syncDietaryFromUser('u1')).rejects.toThrow(
      AppException,
    );
    await expect(service.syncDietaryFromUser('u1')).rejects.toMatchObject({
      errorCode: 'FAMILY_PROFILE.NOT_FOUND',
    });
    expect(repo.updateRestrictions).not.toHaveBeenCalled();
  });

  it('user prefs Vegan+GlutenFree + restrictions existentes → union', async () => {
    repo.findByUser.mockResolvedValue(fakeFamily(['sin-azucar']));
    usersService.findById.mockResolvedValue(
      fakeUser({ prefersVegan: true, prefersGlutenFree: true }),
    );
    repo.updateRestrictions.mockImplementation((userId, restrictions) =>
      Promise.resolve(fakeFamily(restrictions)),
    );

    const result = await service.syncDietaryFromUser('u1');

    expect(repo.updateRestrictions).toHaveBeenCalledWith(
      'u1',
      expect.arrayContaining(['sin-azucar', 'vegan', 'glutenFree']),
    );
    expect(result.restrictions).toContain('vegan');
    expect(result.restrictions).toContain('glutenFree');
    expect(result.restrictions).toContain('sin-azucar');
  });

  it('user sem prefs ativos → restrictions permanece como estava (idempotente)', async () => {
    repo.findByUser.mockResolvedValue(fakeFamily(['sin-sal']));
    usersService.findById.mockResolvedValue(fakeUser());
    repo.updateRestrictions.mockImplementation((userId, restrictions) =>
      Promise.resolve(fakeFamily(restrictions)),
    );

    const result = await service.syncDietaryFromUser('u1');

    expect(result.restrictions).toEqual(['sin-sal']);
  });
});
