import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { EmailVerificationToken, User } from '@prisma/client';
import { createHash } from 'crypto';
import { AppException } from '../../common/exceptions/app-exception';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function buildUser(partial: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'maria@example.com',
    phone: null,
    passwordHash: 'hash',
    name: 'Maria',
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
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...partial,
  } as User;
}

function buildToken(partial: Partial<EmailVerificationToken> = {}): EmailVerificationToken {
  return {
    id: 't1',
    userId: 'u1',
    tokenHash: sha256('plain-token'),
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    createdAt: new Date(),
    ...partial,
  } as EmailVerificationToken;
}

function buildService() {
  const repo = {
    findVerificationTokenByHash: jest.fn(),
    claimVerificationToken: jest.fn(),
    markUserEmailVerified: jest.fn(),
    createVerificationToken: jest.fn(),
    createRefreshToken: jest.fn(),
    findActiveRefreshTokens: jest.fn(),
    findActiveRefreshTokensAnyExpiry: jest.fn(),
    revokeAllActive: jest.fn(),
    revokeById: jest.fn(),
  } as unknown as jest.Mocked<AuthRepository>;

  const usersService = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    createUser: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const emailService = {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<EmailService>;

  const config = {
    get: jest.fn(<T>(_k: string, def?: T) => def as T),
    getOrThrow: jest.fn(() => 'secret-that-is-32-chars-or-longer-aaaaa'),
  } as unknown as jest.Mocked<ConfigService>;

  const jwt = {
    signAsync: jest.fn().mockResolvedValue('jwt'),
    verifyAsync: jest.fn(),
  } as unknown as jest.Mocked<JwtService>;

  return {
    svc: new AuthService(usersService, jwt, config, repo, emailService),
    repo,
    usersService,
    emailService,
    config,
  };
}

describe('AuthService.verifyEmail', () => {
  it('BAD_REQUEST quando token não existe', async () => {
    const { svc, repo } = buildService();
    repo.findVerificationTokenByHash.mockResolvedValue(null);

    const err = await svc.verifyEmail('qualquer').catch((e) => e);
    expect(err).toBeInstanceOf(AppException);
    expect(err.errorCode).toBe('AUTH.VERIFY_INVALID');
    expect((err as AppException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });

  it('GONE quando token já usado', async () => {
    const { svc, repo } = buildService();
    repo.findVerificationTokenByHash.mockResolvedValue(
      buildToken({ usedAt: new Date() }),
    );

    const err = await svc.verifyEmail('plain-token').catch((e) => e);
    expect(err.errorCode).toBe('AUTH.VERIFY_USED');
    expect((err as AppException).getStatus()).toBe(HttpStatus.GONE);
  });

  it('GONE quando token expirado', async () => {
    const { svc, repo } = buildService();
    repo.findVerificationTokenByHash.mockResolvedValue(
      buildToken({ expiresAt: new Date(Date.now() - 1000) }),
    );

    const err = await svc.verifyEmail('plain-token').catch((e) => e);
    expect(err.errorCode).toBe('AUTH.VERIFY_EXPIRED');
    expect((err as AppException).getStatus()).toBe(HttpStatus.GONE);
  });

  it('verifica + marca user quando claim vence', async () => {
    const { svc, repo } = buildService();
    repo.findVerificationTokenByHash.mockResolvedValue(buildToken());
    repo.claimVerificationToken.mockResolvedValue(1);
    repo.markUserEmailVerified.mockResolvedValue(undefined);

    await expect(svc.verifyEmail('plain-token')).resolves.toEqual({
      status: 'verified',
    });
    expect(repo.markUserEmailVerified).toHaveBeenCalledWith(
      'u1',
      expect.any(Date),
    );
  });

  it('GONE em double-submit (claim retorna 0)', async () => {
    const { svc, repo } = buildService();
    repo.findVerificationTokenByHash.mockResolvedValue(buildToken());
    repo.claimVerificationToken.mockResolvedValue(0);

    const err = await svc.verifyEmail('plain-token').catch((e) => e);
    expect(err.errorCode).toBe('AUTH.VERIFY_USED');
    expect((err as AppException).getStatus()).toBe(HttpStatus.GONE);
    expect(repo.markUserEmailVerified).not.toHaveBeenCalled();
  });
});

describe('AuthService.resendVerification', () => {
  it('retorna no_email quando user sem email', async () => {
    const { svc, usersService, emailService } = buildService();
    usersService.findById.mockResolvedValue(
      buildUser({ email: null, phone: '+34600111222' }),
    );

    await expect(svc.resendVerification('u1')).resolves.toEqual({
      status: 'no_email',
    });
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('retorna already_verified quando user já confirmou', async () => {
    const { svc, usersService, emailService } = buildService();
    usersService.findById.mockResolvedValue(
      buildUser({ emailVerifiedAt: new Date() }),
    );

    await expect(svc.resendVerification('u1')).resolves.toEqual({
      status: 'already_verified',
    });
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('despacha email + retorna sent', async () => {
    const { svc, usersService, repo, emailService, config } = buildService();
    usersService.findById.mockResolvedValue(buildUser());
    repo.createVerificationToken.mockResolvedValue(undefined);
    (config.get as jest.Mock).mockImplementation(
      (key: string, def?: unknown) => {
        if (key === 'EMAIL_VERIFY_BASE_URL') return 'http://localhost:3000';
        return def;
      },
    );

    await expect(svc.resendVerification('u1')).resolves.toEqual({
      status: 'sent',
    });
    expect(repo.createVerificationToken).toHaveBeenCalledTimes(1);
    expect(emailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    const arg = (emailService.sendVerificationEmail as jest.Mock).mock.calls[0][0];
    expect(arg.to).toBe('maria@example.com');
    expect(arg.verifyUrl).toMatch(
      /^http:\/\/localhost:3000\/verify-email\?token=[a-f0-9]{64}$/,
    );
    expect(arg.locale).toBe('es');
  });

  it('não lança quando EmailService falha', async () => {
    const { svc, usersService, repo, emailService } = buildService();
    usersService.findById.mockResolvedValue(buildUser());
    repo.createVerificationToken.mockResolvedValue(undefined);
    (emailService.sendVerificationEmail as jest.Mock).mockRejectedValueOnce(
      new Error('smtp down'),
    );

    await expect(svc.resendVerification('u1')).resolves.toEqual({
      status: 'sent',
    });
  });
});

