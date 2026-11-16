import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface VerificationEmailPayload {
  to: string;
  name?: string | null;
  locale: 'es' | 'pt-BR';
  verifyUrl: string;
}

const COPY = {
  es: {
    subject: 'Confirma tu email en Cesta',
    hello: (name?: string | null) =>
      name ? `Hola ${name},` : 'Hola,',
    body: 'Gracias por registrarte en Cesta. Confirma tu email para activar tu cuenta y empezar a comparar precios.',
    cta: 'Confirmar email',
    footer:
      'Si no fuiste tú, ignora este mensaje. El enlace caduca en 24 horas.',
  },
  'pt-BR': {
    subject: 'Confirme seu email no Cesta',
    hello: (name?: string | null) =>
      name ? `Olá, ${name},` : 'Olá,',
    body: 'Obrigado por se cadastrar no Cesta. Confirme seu email para ativar sua conta e começar a comparar preços.',
    cta: 'Confirmar email',
    footer: 'Se não foi você, ignore esta mensagem. O link expira em 24 horas.',
  },
} as const;

// GDPR Sprint 59: email é PII. Nunca logar in-clear — Sentry breadcrumb captura
// NestJS Logger auto e vaza em Replay/Issues. maskEmail mantém a observabilidade
// (prefixo pra diagnose + domínio pra identificar provider) sem expor o local-part.
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const prefix = local.slice(0, 2);
  return `${prefix}***${domain}`;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY', 'disabled');
    this.from = this.config.get<string>(
      'RESEND_FROM',
      'Cesta <noreply@cesta.app>',
    );
    this.client = apiKey && apiKey !== 'disabled' ? new Resend(apiKey) : null;
    if (!this.client) {
      this.logger.warn(
        'Resend desabilitado (RESEND_API_KEY=disabled). EmailService virou no-op.',
      );
    }
  }

  async sendVerificationEmail(payload: VerificationEmailPayload): Promise<void> {
    const copy = COPY[payload.locale] ?? COPY.es;
    const html = this.renderVerificationHtml(copy, payload);
    const text = this.renderVerificationText(copy, payload);
    const masked = maskEmail(payload.to);

    if (!this.client) {
      // Dev-only: link completo no log local pra debug do fluxo sem Resend real.
      // Em prod RESEND_API_KEY está setado → ramo nunca executa, zero vazamento.
      this.logger.log(
        `[no-op] verification email para ${masked} — link: ${payload.verifyUrl}`,
      );
      return;
    }

    try {
      const result = await this.client.emails.send({
        from: this.from,
        to: payload.to,
        subject: copy.subject,
        html,
        text,
      });
      if (result.error) {
        this.logger.error(
          `Resend falhou para ${masked}: ${result.error.message}`,
        );
        return;
      }
      this.logger.log(
        `verification email enviado para ${masked} (id=${result.data?.id ?? 'n/a'})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Resend exception para ${masked}: ${msg}`);
    }
  }

  private renderVerificationHtml(
    copy: (typeof COPY)[keyof typeof COPY],
    payload: VerificationEmailPayload,
  ): string {
    return `<!doctype html>
<html>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f7f5;margin:0;padding:24px;color:#1a1a1a">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
      <tr><td>
        <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(copy.subject)}</h1>
        <p style="margin:0 0 12px">${escapeHtml(copy.hello(payload.name))}</p>
        <p style="margin:0 0 24px">${escapeHtml(copy.body)}</p>
        <p style="margin:0 0 24px">
          <a href="${escapeHtml(payload.verifyUrl)}"
             style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
            ${escapeHtml(copy.cta)}
          </a>
        </p>
        <p style="margin:0 0 8px;font-size:13px;color:#666">${escapeHtml(copy.footer)}</p>
        <p style="margin:0;font-size:12px;color:#999;word-break:break-all">${escapeHtml(payload.verifyUrl)}</p>
      </td></tr>
    </table>
  </body>
</html>`;
  }

  private renderVerificationText(
    copy: (typeof COPY)[keyof typeof COPY],
    payload: VerificationEmailPayload,
  ): string {
    return `${copy.hello(payload.name)}\n\n${copy.body}\n\n${copy.cta}: ${payload.verifyUrl}\n\n${copy.footer}\n`;
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
