import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { JwtRotationService } from './jwt-rotation.service';

function buildRotation(env: Record<string, string | undefined>) {
  const jwt = new JwtService({});
  const config = {
    get: <T>(key: string, def?: T) =>
      (env[key] as unknown as T) ?? (def as T),
    getOrThrow: <T>(key: string): T => {
      const v = env[key];
      if (!v) throw new Error(`missing ${key}`);
      return v as unknown as T;
    },
  } as unknown as ConfigService;
  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  return {
    rotation: new JwtRotationService(jwt, config, audit),
    jwt,
    audit,
  };
}

describe('JwtRotationService', () => {
  const PREV = 'previous_secret_32_chars_minimum_abcdef';
  const CURR = 'current_secret_32_chars_minimum_abcdefg';

  it('sign com CURRENT + verify com CURRENT retorna payload', async () => {
    const { rotation } = buildRotation({
      JWT_ACCESS_SECRET_CURRENT: CURR,
      JWT_REFRESH_SECRET_CURRENT: CURR,
    });
    const token = await rotation.signAccess(
      { sub: 'u1', roles: ['user'] },
      '15m',
    );
    const payload = await rotation.verifyAccess<{ sub: string }>(token);
    expect(payload.sub).toBe('u1');
  });

  it('token assinado com PREVIOUS valida via fallback quando _PREVIOUS set', async () => {
    const { jwt } = buildRotation({
      JWT_ACCESS_SECRET_CURRENT: CURR,
      JWT_REFRESH_SECRET_CURRENT: CURR,
    });
    const legacyToken = await jwt.signAsync(
      { sub: 'u2', roles: ['user'] },
      { secret: PREV, expiresIn: '15m' as unknown as number },
    );

    const { rotation: rotWithPrev } = buildRotation({
      JWT_ACCESS_SECRET_CURRENT: CURR,
      JWT_ACCESS_SECRET_PREVIOUS: PREV,
      JWT_REFRESH_SECRET_CURRENT: CURR,
    });
    const payload = await rotWithPrev.verifyAccess<{ sub: string }>(legacyToken);
    expect(payload.sub).toBe('u2');
  });

  it('rejeita quando token assinado com secret que não é CURRENT nem PREVIOUS', async () => {
    const { jwt } = buildRotation({
      JWT_ACCESS_SECRET_CURRENT: CURR,
      JWT_REFRESH_SECRET_CURRENT: CURR,
    });
    const foreign = await jwt.signAsync(
      { sub: 'u3', roles: ['user'] },
      {
        secret: 'completely_unrelated_secret_32chars_xx',
        expiresIn: '15m' as unknown as number,
      },
    );

    const { rotation: rotWithPrev } = buildRotation({
      JWT_ACCESS_SECRET_CURRENT: CURR,
      JWT_ACCESS_SECRET_PREVIOUS: PREV,
      JWT_REFRESH_SECRET_CURRENT: CURR,
    });
    await expect(rotWithPrev.verifyAccess(foreign)).rejects.toThrow();
  });
});
