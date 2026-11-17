import { ConfigService } from '@nestjs/config';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

/**
 * Sprint 96: endpoints /users/me/push-subscription — subscribe retorna
 * {id, endpoint}; revokeById só deleta se dono bater.
 */
describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: {
    upsertSubscription: jest.Mock;
    findByUser: jest.Mock;
    findByIdForUser: jest.Mock;
    deleteById: jest.Mock;
  };
  let config: ConfigService;

  beforeEach(() => {
    repo = {
      upsertSubscription: jest.fn(),
      findByUser: jest.fn(),
      findByIdForUser: jest.fn(),
      deleteById: jest.fn().mockResolvedValue(undefined),
    };
    config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'VAPID_PUBLIC_KEY') return 'disabled';
        if (key === 'VAPID_PRIVATE_KEY') return 'disabled';
        return fallback;
      }),
      getOrThrow: jest.fn(),
    } as unknown as ConfigService;

    service = new NotificationsService(
      repo as unknown as NotificationsRepository,
      config,
    );
  });

  it('subscribe: upsert e retorna {id, endpoint}', async () => {
    repo.upsertSubscription.mockResolvedValue({
      id: 'ps1',
      endpoint: 'https://push.example/abc',
    });

    const res = await service.subscribe('u1', {
      endpoint: 'https://push.example/abc',
      keys: { p256dh: 'p256', auth: 'auth' },
      userAgent: 'ua',
    });

    expect(res).toEqual({ id: 'ps1', endpoint: 'https://push.example/abc' });
    expect(repo.upsertSubscription).toHaveBeenCalledWith({
      userId: 'u1',
      endpoint: 'https://push.example/abc',
      p256dh: 'p256',
      auth: 'auth',
      userAgent: 'ua',
    });
  });

  it('revokeById: deleta quando dono bate', async () => {
    repo.findByIdForUser.mockResolvedValue({ id: 'ps1' });

    const ok = await service.revokeById('u1', 'ps1');

    expect(ok).toBe(true);
    expect(repo.deleteById).toHaveBeenCalledWith('ps1');
  });

  it('revokeById: não deleta quando subscription pertence a outro user', async () => {
    repo.findByIdForUser.mockResolvedValue(null);

    const ok = await service.revokeById('u1', 'ps1');

    expect(ok).toBe(false);
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it('getPublicKey: null quando VAPID desabilitado', () => {
    expect(service.getPublicKey()).toEqual({ publicKey: null });
  });
});
