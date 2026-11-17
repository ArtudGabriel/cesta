import { Test } from '@nestjs/testing';
import { FamilyProfilesRepository } from '../family-profiles/family-profiles.repository';
import { USER_CLEANUP_QUEUE } from './user-cleanup.constants';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

// Mesma forma do token que @nestjs/bullmq getQueueToken produz, hardcoded
// como string pra evitar carga ESM-only de @nestjs/bull-shared em Jest.
const USER_CLEANUP_QUEUE_TOKEN = `BullQueue_${USER_CLEANUP_QUEUE}`;

describe('UsersService.updateProfile', () => {
  let service: UsersService;
  let repoMock: {
    findById: jest.Mock;
    update: jest.Mock;
    exportUserData: jest.Mock;
    softDeleteWithRevoke: jest.Mock;
  };
  let queueMock: { add: jest.Mock };
  let familyProfilesRepoMock: {
    findByUser: jest.Mock;
    updateRestrictions: jest.Mock;
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
      exportUserData: jest.fn(),
      softDeleteWithRevoke: jest.fn(),
    };
    queueMock = { add: jest.fn() };
    familyProfilesRepoMock = {
      findByUser: jest.fn().mockResolvedValue(null),
      updateRestrictions: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repoMock },
        { provide: USER_CLEANUP_QUEUE_TOKEN, useValue: queueMock },
        {
          provide: FamilyProfilesRepository,
          useValue: familyProfilesRepoMock,
        },
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

  it('exportMyData retorna ZIP válido com 6 CSVs + filename + sem passwordHash leakando (Sprint 91 GDPR Art. 20)', async () => {
    repoMock.exportUserData.mockResolvedValue({
      ...fakeUser({ email: 'maria@test.com' }),
      favorites: [
        { id: 'f1', productId: 'p1', createdAt: new Date('2026-05-01'), product: { id: 'p1', name: 'Aceite', brand: 'Marca' } },
      ],
      shoppingLists: [
        {
          id: 'l1', name: 'Semana', createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-02'),
          items: [
            { productId: 'p1', product: { id: 'p1', name: 'Aceite' }, quantity: 2, position: 0 },
          ],
        },
      ],
      reviews: [
        { id: 'rv1', productId: 'p1', product: { id: 'p1', name: 'Aceite' }, rating: 5, comment: 'Bueno, "muy" bueno', createdAt: new Date('2026-05-03') },
      ],
      alerts: [
        { id: 'a1', productId: 'p1', product: { id: 'p1', name: 'Aceite' }, type: 'target_price', targetPrice: 3.99, isActive: true, createdAt: new Date('2026-05-04') },
      ],
      receipts: [
        {
          id: 'rc1', supermarketSlug: 'mercadona', purchaseDate: new Date('2026-05-05'), total: 42.5, status: 'ready', createdAt: new Date('2026-05-05'),
          items: [
            { normalizedName: 'Aceite', rawText: 'ACEITE OLIVA', quantity: 1, unitPrice: 3.99, total: 3.99 },
          ],
        },
      ],
      familyProfile: null,
      familyBaskets: [],
      searchHistory: [],
    });

    const result = await service.exportMyData('u1');

    expect(repoMock.exportUserData).toHaveBeenCalledWith('u1');
    expect(Buffer.isBuffer(result.zip)).toBe(true);
    expect(result.zip.length).toBeGreaterThan(0);
    expect(result.filename).toMatch(/^cesta-datos-u1-.*\.zip$/);
    expect(result.files).toEqual(
      expect.arrayContaining(['perfil.csv', 'favoritos.csv', 'listas.csv', 'alertas.csv', 'reviews.csv', 'expenses.csv']),
    );
    // passwordHash nunca pode aparecer no zip binário
    expect(result.zip.toString('utf8')).not.toContain('hash-should-not-leak');
  });

  it('exportMyData CSVs têm UTF-8 BOM + dados escapados (Sprint 91)', async () => {
    const JSZip = require('jszip');
    repoMock.exportUserData.mockResolvedValue({
      ...fakeUser({ email: 'test@test.com' }),
      favorites: [],
      shoppingLists: [],
      reviews: [
        { id: 'rv1', productId: 'p1', product: { id: 'p1', name: 'Aceite' }, rating: 5, comment: 'tiene, coma', createdAt: new Date('2026-05-03') },
      ],
      alerts: [],
      receipts: [],
      familyProfile: null,
      familyBaskets: [],
      searchHistory: [],
    });

    const { zip } = await service.exportMyData('u1');
    const archive = await JSZip.loadAsync(zip);
    const perfil = await archive.file('perfil.csv').async('string');
    const reviews = await archive.file('reviews.csv').async('string');

    expect(perfil.charCodeAt(0)).toBe(0xfeff); // BOM
    expect(perfil).toContain('test@test.com');
    expect(reviews).toContain('"tiene, coma"'); // CSV escape
  });

  it('exportMyData user inexistente → NotFoundException', async () => {
    repoMock.exportUserData.mockResolvedValue(null);
    await expect(service.exportMyData('missing')).rejects.toThrow(
      /not found/i,
    );
  });

  it('deleteMyAccount chama softDeleteWithRevoke + enqueues hard-delete 30d (Sprint 64)', async () => {
    repoMock.findById.mockResolvedValue(fakeUser());
    repoMock.softDeleteWithRevoke.mockResolvedValue(fakeUser());
    await service.deleteMyAccount('u1');

    expect(repoMock.findById).toHaveBeenCalledWith('u1');
    expect(repoMock.softDeleteWithRevoke).toHaveBeenCalledWith('u1');
    expect(queueMock.add).toHaveBeenCalledTimes(1);
    const [jobName, payload, options] = queueMock.add.mock.calls[0] as [
      string,
      { userId: string },
      { delay: number; attempts: number },
    ];
    expect(jobName).toBe('hard-delete');
    expect(payload).toEqual({ userId: 'u1' });
    expect(options.delay).toBe(30 * 24 * 60 * 60 * 1000);
    expect(options.attempts).toBe(3);
  });

  it('deleteMyAccount user já deletado → USERS.ALREADY_DELETED (não enqueue)', async () => {
    repoMock.findById.mockResolvedValue(null);
    await expect(service.deleteMyAccount('u1')).rejects.toMatchObject({
      errorCode: 'USERS.ALREADY_DELETED',
    });
    expect(repoMock.softDeleteWithRevoke).not.toHaveBeenCalled();
    expect(queueMock.add).not.toHaveBeenCalled();
  });

  it('PATCH prefersVegan=true + user tem FamilyProfile → restrictions ganha "vegan" (Sprint 65)', async () => {
    repoMock.update.mockResolvedValue(fakeUser({ prefersVegan: true }));
    familyProfilesRepoMock.findByUser.mockResolvedValue({
      userId: 'u1',
      restrictions: ['glutenFree'],
    });
    await service.updateProfile('u1', { prefersVegan: true });

    expect(familyProfilesRepoMock.findByUser).toHaveBeenCalledWith('u1');
    expect(familyProfilesRepoMock.updateRestrictions).toHaveBeenCalledTimes(1);
    const [userId, merged] =
      familyProfilesRepoMock.updateRestrictions.mock.calls[0] as [
        string,
        string[],
      ];
    expect(userId).toBe('u1');
    // Merge: 'glutenFree' preservado (non-dietary não é aplicável aqui porque
    // 'glutenFree' ∈ DIETARY_KEYS; depende apenas das prefs). After merge,
    // final set reflete prefers*: só 'vegan' (prefersGlutenFree=false).
    expect(new Set(merged)).toEqual(new Set(['vegan']));
  });

  it('PATCH prefersVegan=false com restrictions=["vegan"] → remove "vegan" (Sprint 65)', async () => {
    repoMock.update.mockResolvedValue(fakeUser({ prefersVegan: false }));
    familyProfilesRepoMock.findByUser.mockResolvedValue({
      userId: 'u1',
      restrictions: ['vegan'],
    });
    await service.updateProfile('u1', { prefersVegan: false });

    const [, merged] =
      familyProfilesRepoMock.updateRestrictions.mock.calls[0] as [
        string,
        string[],
      ];
    expect(merged).toEqual([]);
  });

  it('PATCH prefersVegan=true + user SEM FamilyProfile → no-op sync (Sprint 65)', async () => {
    repoMock.update.mockResolvedValue(fakeUser({ prefersVegan: true }));
    familyProfilesRepoMock.findByUser.mockResolvedValue(null);
    await service.updateProfile('u1', { prefersVegan: true });

    expect(familyProfilesRepoMock.findByUser).toHaveBeenCalledWith('u1');
    expect(familyProfilesRepoMock.updateRestrictions).not.toHaveBeenCalled();
  });

  it('PATCH sem dietary prefs mudadas → não chama FamilyProfilesRepo (Sprint 65)', async () => {
    repoMock.update.mockResolvedValue(fakeUser({ name: 'Novo' }));
    await service.updateProfile('u1', { name: 'Novo' });

    expect(familyProfilesRepoMock.findByUser).not.toHaveBeenCalled();
    expect(familyProfilesRepoMock.updateRestrictions).not.toHaveBeenCalled();
  });

  it('PATCH prefersVegan=true preserva restrictions non-dietary (ex: kosher) (Sprint 65)', async () => {
    repoMock.update.mockResolvedValue(fakeUser({ prefersVegan: true }));
    familyProfilesRepoMock.findByUser.mockResolvedValue({
      userId: 'u1',
      restrictions: ['kosher', 'glutenFree'],
    });
    await service.updateProfile('u1', { prefersVegan: true });

    const [, merged] =
      familyProfilesRepoMock.updateRestrictions.mock.calls[0] as [
        string,
        string[],
      ];
    // kosher preservado (non-dietary), glutenFree removido (prefs=false),
    // vegan adicionado (prefs=true).
    expect(new Set(merged)).toEqual(new Set(['kosher', 'vegan']));
  });
});
