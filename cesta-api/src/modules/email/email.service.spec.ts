import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

function buildConfig(values: Record<string, string>): ConfigService {
  return {
    get: jest.fn(<T>(key: string, def?: T) => (values[key] ?? def) as T),
  } as unknown as ConfigService;
}

describe('EmailService', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 'msg_123' }, error: null });
  });

  it('no-op quando RESEND_API_KEY=disabled', async () => {
    const svc = new EmailService(
      buildConfig({
        RESEND_API_KEY: 'disabled',
        RESEND_FROM: 'Cesta <noreply@cesta.app>',
      }),
    );

    await svc.sendVerificationEmail({
      to: 'maria@example.com',
      name: 'Maria',
      locale: 'es',
      verifyUrl: 'http://localhost:3000/verify-email?token=abc',
    });

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('envia via Resend com subject ES quando locale=es', async () => {
    const svc = new EmailService(
      buildConfig({
        RESEND_API_KEY: 're_key_live',
        RESEND_FROM: 'Cesta <noreply@cesta.app>',
      }),
    );

    await svc.sendVerificationEmail({
      to: 'maria@example.com',
      name: 'Maria',
      locale: 'es',
      verifyUrl: 'http://localhost:3000/verify-email?token=abc',
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe('maria@example.com');
    expect(arg.from).toBe('Cesta <noreply@cesta.app>');
    expect(arg.subject).toBe('Confirma tu email en Cesta');
    expect(arg.html).toContain('http://localhost:3000/verify-email?token=abc');
    expect(arg.text).toContain(
      'http://localhost:3000/verify-email?token=abc',
    );
  });

  it('usa subject PT-BR quando locale=pt-BR', async () => {
    const svc = new EmailService(
      buildConfig({
        RESEND_API_KEY: 're_key_live',
        RESEND_FROM: 'Cesta <noreply@cesta.app>',
      }),
    );

    await svc.sendVerificationEmail({
      to: 'joao@example.com',
      name: null,
      locale: 'pt-BR',
      verifyUrl: 'http://localhost:3000/verify-email?token=xyz',
    });

    const arg = sendMock.mock.calls[0][0];
    expect(arg.subject).toBe('Confirme seu email no Cesta');
    expect(arg.text).toContain('Olá');
  });

  it('escapa HTML nos campos dinâmicos', async () => {
    const svc = new EmailService(
      buildConfig({
        RESEND_API_KEY: 're_key_live',
        RESEND_FROM: 'Cesta <noreply@cesta.app>',
      }),
    );

    await svc.sendVerificationEmail({
      to: 'eve@example.com',
      name: '<script>alert(1)</script>',
      locale: 'es',
      verifyUrl: 'http://localhost:3000/verify-email?token=safe',
    });

    const arg = sendMock.mock.calls[0][0];
    expect(arg.html).not.toContain('<script>alert(1)</script>');
    expect(arg.html).toContain('&lt;script&gt;');
  });

  it('não lança quando Resend retorna erro', async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'rate limit', name: 'rate_limited' },
    });
    const svc = new EmailService(
      buildConfig({
        RESEND_API_KEY: 're_key_live',
        RESEND_FROM: 'Cesta <noreply@cesta.app>',
      }),
    );

    await expect(
      svc.sendVerificationEmail({
        to: 'maria@example.com',
        name: null,
        locale: 'es',
        verifyUrl: 'http://localhost:3000/verify-email?token=abc',
      }),
    ).resolves.toBeUndefined();
  });

  it('mascara email em logs (GDPR) — sucesso', async () => {
    const svc = new EmailService(
      buildConfig({
        RESEND_API_KEY: 're_key_live',
        RESEND_FROM: 'Cesta <noreply@cesta.app>',
      }),
    );
    const logSpy = jest
      .spyOn((svc as unknown as { logger: Logger }).logger, 'log')
      .mockImplementation(() => undefined);

    await svc.sendVerificationEmail({
      to: 'maria.garcia@example.com',
      name: null,
      locale: 'es',
      verifyUrl: 'http://localhost:3000/verify-email?token=abc',
    });

    const joined = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(joined).not.toContain('maria.garcia@example.com');
    expect(joined).toContain('ma***@example.com');
  });

  it('mascara email em logs (GDPR) — erro Resend', async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'rate limit', name: 'rate_limited' },
    });
    const svc = new EmailService(
      buildConfig({
        RESEND_API_KEY: 're_key_live',
        RESEND_FROM: 'Cesta <noreply@cesta.app>',
      }),
    );
    const errSpy = jest
      .spyOn((svc as unknown as { logger: Logger }).logger, 'error')
      .mockImplementation(() => undefined);

    await svc.sendVerificationEmail({
      to: 'eve@example.com',
      name: null,
      locale: 'es',
      verifyUrl: 'http://localhost:3000/verify-email?token=x',
    });

    const joined = errSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(joined).not.toContain('eve@example.com');
    expect(joined).toContain('ev***@example.com');
  });
});
