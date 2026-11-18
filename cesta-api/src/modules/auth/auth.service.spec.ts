import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailVerificationToken, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { AppException } from '../../common/exceptions/app-exception';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { JwtRotationService } from './jwt-rotation.service';
import { TwoFactorService } from './two-factor/two-factor.service';

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
    graceReminderSentAt: null,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: [],
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
    findByEmailIncludingDeleted: jest.fn(),
    findByPhoneIncludingDeleted: jest.fn(),
    reactivateUser: jest.fn(),
    createUser: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const emailService = {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<EmailService>;

  const config = {
    get: jest.fn(<T>(_k: string, def?: T) => def as T),
    getOrThrow: jest.fn(() => 'secret-that-is-32-chars-or-longer-aaaaa'),
  } as unknown as jest.Mocked<ConfigService>;

  const rotation = {
    signAccess: jest.fn().mockResolvedValue('jwt'),
    signRefresh: jest.fn().mockResolvedValue('jwt'),
    verifyAccess: jest.fn(),
    verifyRefresh: jest.fn(),
  } as unknown as jest.Mocked<JwtRotationService>;

  const twoFactorService = {
    issuePartialToken: jest.fn(),
  } as unknown as jest.Mocked<TwoFactorService>;

  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  return {
    svc: new AuthService(
      usersService,
      rotation,
      config,
      repo,
      emailService,
      twoFactorService,
      audit,
    ),
    repo,
    usersService,
    emailService,
    config,
    rotation,
    twoFactorService,
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

describe('AuthService.login (soft-delete grace)', () => {
  it('CONFLICT ACCOUNT_SOFT_DELETED com meta dentro do grace period', async () => {
    const { svc, usersService } = buildService();
    const passwordHash = await bcrypt.hash('secret123', 4);
    const deletedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2d atrás
    usersService.findByEmailIncludingDeleted.mockResolvedValue(
      buildUser({ passwordHash, deletedAt }),
    );

    const err = await svc
      .login({ email: 'maria@example.com', password: 'secret123' })
      .catch((e) => e);

    expect(err).toBeInstanceOf(AppException);
    expect(err.errorCode).toBe('AUTH.ACCOUNT_SOFT_DELETED');
    expect((err as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
    const meta = (err as AppException).meta as {
      deletedAt: string;
      graceEndsAt: string;
    };
    expect(meta.deletedAt).toBe(deletedAt.toISOString());
    const expected = new Date(
      deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(meta.graceEndsAt).toBe(expected);
  });

  it('INVALID_CREDENTIALS quando grace period expirou', async () => {
    const { svc, usersService } = buildService();
    const passwordHash = await bcrypt.hash('secret123', 4);
    const deletedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    usersService.findByEmailIncludingDeleted.mockResolvedValue(
      buildUser({ passwordHash, deletedAt }),
    );

    const err = await svc
      .login({ email: 'maria@example.com', password: 'secret123' })
      .catch((e) => e);

    expect(err.errorCode).toBe('AUTH.INVALID_CREDENTIALS');
    expect((err as AppException).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
  });
});

describe('AuthService.reactivateAccount', () => {
  it('reativa + emite tokens quando credenciais válidas dentro de 30d', async () => {
    const { svc, usersService, repo } = buildService();
    const passwordHash = await bcrypt.hash('secret123', 4);
    const deletedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const softDeleted = buildUser({ passwordHash, deletedAt });
    const revived = buildUser({ passwordHash, deletedAt: null });
    usersService.findByEmailIncludingDeleted.mockResolvedValue(softDeleted);
    usersService.reactivateUser.mockResolvedValue(revived);
    repo.createRefreshToken.mockResolvedValue(undefined);

    const result = await svc.reactivateAccount({
      email: 'maria@example.com',
      password: 'secret123',
    });

    expect(usersService.reactivateUser).toHaveBeenCalledWith('u1');
    expect(result.user.id).toBe('u1');
    expect(result.tokens.accessToken).toBe('jwt');
    expect(result.tokens.refreshToken).toBe('jwt');
  });

  it('GONE REACTIVATE_WINDOW_EXPIRED quando passou do grace', async () => {
    const { svc, usersService } = buildService();
    const passwordHash = await bcrypt.hash('secret123', 4);
    usersService.findByEmailIncludingDeleted.mockResolvedValue(
      buildUser({
        passwordHash,
        deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      }),
    );

    const err = await svc
      .reactivateAccount({
        email: 'maria@example.com',
        password: 'secret123',
      })
      .catch((e) => e);

    expect(err.errorCode).toBe('AUTH.REACTIVATE_WINDOW_EXPIRED');
    expect((err as AppException).getStatus()).toBe(HttpStatus.GONE);
  });

  it('BAD_REQUEST ACCOUNT_ALREADY_ACTIVE quando user não está soft-deleted', async () => {
    const { svc, usersService } = buildService();
    const passwordHash = await bcrypt.hash('secret123', 4);
    usersService.findByEmailIncludingDeleted.mockResolvedValue(
      buildUser({ passwordHash, deletedAt: null }),
    );

    const err = await svc
      .reactivateAccount({
        email: 'maria@example.com',
        password: 'secret123',
      })
      .catch((e) => e);

    expect(err.errorCode).toBe('AUTH.ACCOUNT_ALREADY_ACTIVE');
    expect((err as AppException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });

  it('INVALID_CREDENTIALS quando senha errada (não vaza existência da conta)', async () => {
    const { svc, usersService } = buildService();
    const passwordHash = await bcrypt.hash('secret123', 4);
    usersService.findByEmailIncludingDeleted.mockResolvedValue(
      buildUser({
        passwordHash,
        deletedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      }),
    );

    const err = await svc
      .reactivateAccount({
        email: 'maria@example.com',
        password: 'wrong',
      })
      .catch((e) => e);

    expect(err.errorCode).toBe('AUTH.INVALID_CREDENTIALS');
    expect((err as AppException).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
  });
});

