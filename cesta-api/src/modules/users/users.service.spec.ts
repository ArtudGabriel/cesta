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

  it('DTO vazio: não chama update, retorna user atual via findById', async () => {
    repoMock.findById.mockResolvedValue(fakeUser());
    const result = await service.updateProfile('u1', {});

    expect(repoMock.update).not.toHaveBeenCalled();
    expect(repoMock.findById).toHaveBeenCalledWith('u1');
    expect(result.id).toBe('u1');
    expect(result).not.toHaveProperty('passwordHash');
  });
});
