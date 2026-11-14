import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

describe('UsersService.updateProfile', () => {
  let service: UsersService;
  let repoMock: {
    findById: jest.Mock;
    update: jest.Mock;
  };

  const fakeUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'u1',
    email: 'a@b.com',
    phone: null,
    passwordHash: 'hash-should-not-leak',
    name: 'Original',
    locale: 'es',
    roles: ['user'],
    prefersVegan: false,
    prefersVegetarian: false,
    prefersGlutenFree: false,
    prefersLactoseFree: false,
    sortUnitPreference: 'absolute',
    nutriSortEnabled: false,
    nutriHealthyOnly: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    repoMock = {
      findById: jest.fn(),
      update: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repoMock },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('patch name sozinho', async () => {
    repoMock.update.mockResolvedValue(fakeUser({ name: 'Novo' }));
    const result = await service.updateProfile('u1', { name: 'Novo' });

    expect(repoMock.update).toHaveBeenCalledWith('u1', { name: 'Novo' });
    expect(result.name).toBe('Novo');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('patch locale sozinho', async () => {
    repoMock.update.mockResolvedValue(fakeUser({ locale: 'pt-BR' }));
    const result = await service.updateProfile('u1', { locale: 'pt-BR' });

    expect(repoMock.update).toHaveBeenCalledWith('u1', { locale: 'pt-BR' });
    expect(result.locale).toBe('pt-BR');
  });

  it('patch name + locale juntos', async () => {
    repoMock.update.mockResolvedValue(
      fakeUser({ name: 'Ambos', locale: 'pt-BR' }),
    );
    const result = await service.updateProfile('u1', {
      name: 'Ambos',
      locale: 'pt-BR',
    });

    expect(repoMock.update).toHaveBeenCalledWith('u1', {
      name: 'Ambos',
      locale: 'pt-BR',
    });
    expect(result.name).toBe('Ambos');
    expect(result.locale).toBe('pt-BR');
  });

  it('patch prefersVegan sozinho', async () => {
    repoMock.update.mockResolvedValue(fakeUser({ prefersVegan: true }));
    const result = await service.updateProfile('u1', { prefersVegan: true });

    expect(repoMock.update).toHaveBeenCalledWith('u1', { prefersVegan: true });
    expect(result.prefersVegan).toBe(true);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('patch prefersVegan + prefersGlutenFree juntos', async () => {
    repoMock.update.mockResolvedValue(
      fakeUser({ prefersVegan: true, prefersGlutenFree: true }),
    );
    const result = await service.updateProfile('u1', {
      prefersVegan: true,
      prefersGlutenFree: true,
    });

    expect(repoMock.update).toHaveBeenCalledWith('u1', {
      prefersVegan: true,
      prefersGlutenFree: true,
    });
    expect(result.prefersVegan).toBe(true);
    expect(result.prefersGlutenFree).toBe(true);
    expect(result.prefersVegetarian).toBe(false);
  });

  it('patch sortUnitPreference unit persiste', async () => {
    repoMock.update.mockResolvedValue(fakeUser({ sortUnitPreference: 'unit' }));
    const result = await service.updateProfile('u1', { sortUnitPreference: 'unit' });

    expect(repoMock.update).toHaveBeenCalledWith('u1', { sortUnitPreference: 'unit' });
    expect(result.sortUnitPreference).toBe('unit');
  });

  it('patch nutriHealthyOnly true persiste', async () => {
    repoMock.update.mockResolvedValue(fakeUser({ nutriHealthyOnly: true }));
    const result = await service.updateProfile('u1', { nutriHealthyOnly: true });

    expect(repoMock.update).toHaveBeenCalledWith('u1', { nutriHealthyOnly: true });
    expect(result.nutriHealthyOnly).toBe(true);
    expect(result.nutriSortEnabled).toBe(false);
  });

  it('patch nutriSortEnabled + nutriHealthyOnly juntos', async () => {
    repoMock.update.mockResolvedValue(
      fakeUser({ nutriSortEnabled: true, nutriHealthyOnly: true }),
    );
    const result = await service.updateProfile('u1', {
      nutriSortEnabled: true,
      nutriHealthyOnly: true,
    });

    expect(repoMock.update).toHaveBeenCalledWith('u1', {
      nutriSortEnabled: true,
      nutriHealthyOnly: true,
    });
    expect(result.nutriSortEnabled).toBe(true);
    expect(result.nutriHealthyOnly).toBe(true);
  });

  it('DTO vazio: não chama update, retorna user atual via findById', async () => {
    repoMock.findById.mockResolvedValue(fakeUser());
    const result = await service.updateProfile('u1', {});

    expect(repoMock.update).not.toHaveBeenCalled();
    expect(repoMock.findById).toHaveBeenCalledWith('u1');
    expect(result.id).toBe('u1');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('saveConsent persiste cookieConsentLevel + cookiesAcceptedAt (Sprint 62)', async () => {
    repoMock.update.mockResolvedValue(fakeUser());
    await service.saveConsent('u1', 'all');

    expect(repoMock.update).toHaveBeenCalledTimes(1);
    const [calledUserId, data] = repoMock.update.mock.calls[0] as [
      string,
      { cookieConsentLevel: string; cookiesAcceptedAt: Date },
    ];
    expect(calledUserId).toBe('u1');
    expect(data.cookieConsentLevel).toBe('all');
    expect(data.cookiesAcceptedAt).toBeInstanceOf(Date);
  });

  it('saveConsent level essential também persiste (Sprint 62)', async () => {
    repoMock.update.mockResolvedValue(fakeUser());
    await service.saveConsent('u1', 'essential');

    expect(repoMock.update).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ cookieConsentLevel: 'essential' }),
    );
  });
});
