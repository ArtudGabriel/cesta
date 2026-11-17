import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { AppException } from '../../../common/exceptions/app-exception';
import { UsersService } from '../../users/users.service';
import { AuthRepository } from '../auth.repository';
import { JwtRotationService } from '../jwt-rotation.service';
import { TwoFactorEncryptionService } from './encryption.service';
import { TwoFactorRepository } from './two-factor.repository';
import { TwoFactorService } from './two-factor.service';

authenticator.options = { window: 1 };

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
    graceReminderSentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: [],
    ...partial,
  } as User;
}

function build() {
  const usersService = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;
  const repo = {
    setPendingSecret: jest.fn().mockResolvedValue(undefined),
    enable: jest.fn().mockResolvedValue(undefined),
    disable: jest.fn().mockResolvedValue(undefined),
    consumeBackupCode: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<TwoFactorRepository>;
  // Encryption identidade pra testes: cipher(x)=x.
  const encryption = {
    encrypt: jest.fn((s: string) => s),
    decrypt: jest.fn((s: string) => s),
  } as unknown as jest.Mocked<TwoFactorEncryptionService>;
  const rotation = {
    signAccess: jest.fn().mockResolvedValue('access-jwt'),
    signRefresh: jest.fn().mockResolvedValue('refresh-jwt'),
    verifyAccess: jest.fn(),
    verifyRefresh: jest.fn(),
  } as unknown as jest.Mocked<JwtRotationService>;
  const jwt = {
    signAsync: jest.fn().mockResolvedValue('partial-jwt'),
    verifyAsync: jest.fn(),
  } as unknown as jest.Mocked<JwtService>;
  const config = {
    get: jest.fn((_k: string, d?: unknown) => d),
    getOrThrow: jest.fn(() => 'secret-that-is-at-least-32-chars-aaaaa'),
  } as unknown as jest.Mocked<ConfigService>;
  const authRepo = {
    createRefreshToken: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuthRepository>;

  const svc = new TwoFactorService(
    usersService,
    repo,
    encryption,
    rotation,
    jwt,
    config,
    authRepo,
  );
  return { svc, usersService, repo, encryption, rotation, jwt, authRepo };
}

describe('TwoFactorService.enroll', () => {
  it('gera secret base32 + qrCodeDataUri + otpauthUrl com issuer Cesta', async () => {
    const { svc, usersService, repo } = build();
    usersService.findById.mockResolvedValue(buildUser());

    const result = await svc.enroll('u1');

    expect(result.secret).toMatch(/^[A-Z2-7]+$/);
    expect(result.qrCodeDataUri).toMatch(/^data:image\/png;base64,/);
    expect(result.otpauthUrl).toMatch(/^otpauth:\/\/totp\/.+issuer=Cesta/);
    expect(repo.setPendingSecret).toHaveBeenCalledWith('u1', result.secret);
  });

  it('CONFLICT quando já habilitado', async () => {
    const { svc, usersService } = build();
    usersService.findById.mockResolvedValue(buildUser({ twoFactorEnabled: true }));
    const err = await svc.enroll('u1').catch((e) => e);
    expect(err).toBeInstanceOf(AppException);
    expect(err.errorCode).toBe('AUTH.2FA.ALREADY_ENABLED');
  });
});

describe('TwoFactorService.verify', () => {
  it('habilita 2FA + retorna 10 backup codes com código TOTP correto', async () => {
    const { svc, usersService, repo } = build();
    const secret = authenticator.generateSecret();
    usersService.findById.mockResolvedValue(
      buildUser({ twoFactorSecret: secret, twoFactorEnabled: false }),
    );
    const code = authenticator.generate(secret);

    const result = await svc.verify('u1', code);

    expect(result.enabled).toBe(true);
    expect(result.backupCodes).toHaveLength(10);
    expect(result.backupCodes.every((c) => /^[A-Z0-9]{10}$/.test(c))).toBe(true);
    expect(repo.enable).toHaveBeenCalledWith('u1', expect.any(Array));
    const [, hashes] = repo.enable.mock.calls[0];
    expect(hashes).toHaveLength(10);
    expect(await bcrypt.compare(result.backupCodes[0], hashes[0])).toBe(true);
  });

  it('UNAUTHORIZED com código errado', async () => {
    const { svc, usersService } = build();
    const secret = authenticator.generateSecret();
    usersService.findById.mockResolvedValue(
      buildUser({ twoFactorSecret: secret }),
    );
    const err = await svc.verify('u1', '000000').catch((e) => e);
    expect(err).toBeInstanceOf(AppException);
    expect(err.errorCode).toBe('AUTH.2FA.INVALID_CODE');
  });
});

describe('TwoFactorService.challenge', () => {
  it('emite JWT final com partialToken + código TOTP correto', async () => {
    const { svc, usersService, rotation, authRepo } = build();
    const secret = authenticator.generateSecret();
    usersService.findById.mockResolvedValue(
      buildUser({ twoFactorEnabled: true, twoFactorSecret: secret }),
    );
    rotation.verifyAccess.mockResolvedValue({
      sub: 'u1',
      scope: '2fa_pending',
      jti: 'x',
    } as any);
    const code = authenticator.generate(secret);

    const result = await svc.challenge('partial', code, {});

    expect(result.tokens.accessToken).toBe('access-jwt');
    expect(result.tokens.refreshToken).toBe('refresh-jwt');
    expect(authRepo.createRefreshToken).toHaveBeenCalled();
  });

  it('UNAUTHORIZED com código errado', async () => {
    const { svc, usersService, rotation } = build();
    const secret = authenticator.generateSecret();
    usersService.findById.mockResolvedValue(
      buildUser({ twoFactorEnabled: true, twoFactorSecret: secret }),
    );
    rotation.verifyAccess.mockResolvedValue({
      sub: 'u1',
      scope: '2fa_pending',
      jti: 'x',
    } as any);
    const err = await svc.challenge('partial', '000000', {}).catch((e) => e);
    expect(err.errorCode).toBe('AUTH.2FA.INVALID_CODE');
  });
});

describe('TwoFactorService.recovery', () => {
  it('consome backup code + emite JWT; mesmo code 2x falha', async () => {
    const { svc, usersService, repo, rotation } = build();
    const plain = 'ABCDEFGHIJ';
    const hashed = await bcrypt.hash(plain, 10);
    const other = await bcrypt.hash('OTHERXYZ11', 10);
    usersService.findById.mockResolvedValue(
      buildUser({
        twoFactorEnabled: true,
        twoFactorBackupCodes: [hashed, other],
      }),
    );
    rotation.verifyAccess.mockResolvedValue({
      sub: 'u1',
      scope: '2fa_pending',
      jti: 'x',
    } as any);

    const r1 = await svc.recovery('partial', plain, {});
    expect(r1.tokens.accessToken).toBe('access-jwt');
    expect(repo.consumeBackupCode).toHaveBeenCalledWith('u1', [other]);

    // Segunda chamada com mesmo code — já removido, simular estado atualizado.
    usersService.findById.mockResolvedValue(
      buildUser({
        twoFactorEnabled: true,
        twoFactorBackupCodes: [other],
      }),
    );
    const err = await svc.recovery('partial', plain, {}).catch((e) => e);
    expect(err.errorCode).toBe('AUTH.2FA.INVALID_CODE');
  });
});

describe('TwoFactorService.disable', () => {
  it('senha + código corretos desabilitam 2FA', async () => {
    const { svc, usersService, repo } = build();
    const secret = authenticator.generateSecret();
    const passwordHash = await bcrypt.hash('senha123', 10);
    usersService.findById.mockResolvedValue(
      buildUser({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        passwordHash,
      }),
    );
    const code = authenticator.generate(secret);

    const result = await svc.disable('u1', 'senha123', code);
    expect(result.enabled).toBe(false);
    expect(repo.disable).toHaveBeenCalledWith('u1');
  });

  it('senha errada retorna UNAUTHORIZED e mantém 2FA', async () => {
    const { svc, usersService, repo } = build();
    const secret = authenticator.generateSecret();
    const passwordHash = await bcrypt.hash('senha123', 10);
    usersService.findById.mockResolvedValue(
      buildUser({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        passwordHash,
      }),
    );
    const err = await svc
      .disable('u1', 'wrong', authenticator.generate(secret))
      .catch((e) => e);
    expect(err.errorCode).toBe('AUTH.2FA.INVALID_CREDENTIALS');
    expect(repo.disable).not.toHaveBeenCalled();
  });
});
