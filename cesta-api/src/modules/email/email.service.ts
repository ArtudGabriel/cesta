import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { Resend } from 'resend';

export interface VerificationEmailPayload {
  to: string;
  name?: string | null;
  locale: 'es' | 'pt-BR';
  verifyUrl: string;
}

// Sprint 94 GDPR grace-period reminders. `stage` controla variante de texto
// (7d = aviso, 1d = urgência). reactivateUrl aponta pro /login que detecta
// conta soft-deleted e mostra banner reativar (Sprint 90).
export interface GraceReminderEmailPayload {
  to: string;
  name?: string | null;
  locale: 'es' | 'pt-BR';
  stage: '7d' | '1d';
  reactivateUrl: string;
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

// Sprint 94: copy simétrico ES + PT-BR, 2 variantes (7d/1d) por idioma.
const GRACE_COPY = {
  es: {
    '7d': {
      subject: 'Tu cuenta Cesta se eliminará en 7 días',
      hello: (name?: string | null) => (name ? `Hola ${name},` : 'Hola,'),
      body: 'Tu cuenta está programada para eliminación definitiva en 7 días. Si cambiaste de idea, aún puedes reactivarla con un solo clic.',
      cta: 'Reactivar mi cuenta',
      footer:
        'Después de 30 días desde la solicitud de baja, borraremos todos tus datos de forma permanente (GDPR Art. 17).',
    },
    '1d': {
      subject: 'Último aviso: tu cuenta Cesta se elimina mañana',
      hello: (name?: string | null) => (name ? `Hola ${name},` : 'Hola,'),
      body: 'Esta es tu última oportunidad. Mañana borraremos definitivamente tu cuenta y todos los datos asociados. Si quieres conservarla, reactívala ahora.',
      cta: 'Reactivar mi cuenta ahora',
      footer:
        'Tras la eliminación no podremos recuperar favoritos, listas, reseñas ni historial de gastos (GDPR Art. 17).',
    },
  },
  'pt-BR': {
    '7d': {
      subject: 'Sua conta Cesta será excluída em 7 dias',
      hello: (name?: string | null) => (name ? `Olá, ${name},` : 'Olá,'),
      body: 'Sua conta está programada para exclusão definitiva em 7 dias. Se mudou de ideia, ainda pode reativá-la com um clique.',
      cta: 'Reativar minha conta',
      footer:
        'Após 30 dias da solicitação de exclusão, apagaremos todos os seus dados de forma permanente (LGPD/GDPR Art. 17).',
    },
    '1d': {
      subject: 'Último aviso: sua conta Cesta será excluída amanhã',
      hello: (name?: string | null) => (name ? `Olá, ${name},` : 'Olá,'),
      body: 'Esta é sua última chance. Amanhã apagaremos definitivamente sua conta e todos os dados associados. Se quiser mantê-la, reative agora.',
      cta: 'Reativar minha conta agora',
      footer:
        'Após a exclusão, não poderemos recuperar favoritos, listas, reviews nem histórico de gastos (LGPD/GDPR Art. 17).',
    },
  },
} as const;

type GraceCopy = {
  subject: string;
  hello: (name?: string | null) => string;
  body: string;
  cta: string;
  footer: string;
};

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
    // Sprint 227 (#5 bundle): Render prod expõe RESEND_FROM_ADDRESS +
    // RESEND_FROM_DOMAIN separados (dominio verificado). Compor from aqui
    // garante uso do dominio verificado mesmo quando RESEND_FROM_NAME e
    // opcional (nome amigavel na exibicao do remetente). Sem este fix,
    // codigo caia no default 'Cesta <noreply@cesta.app>' com `cesta.app`
    // nao verificado em Resend → envio silencioso recusado.
    const address = this.config.get<string>('RESEND_FROM_ADDRESS', 'noreply');
    const domain = this.config.get<string>('RESEND_FROM_DOMAIN', 'cesta.app');
    const name = this.config.get<string>('RESEND_FROM_NAME', 'Cesta');
    this.from = name
      ? `${name} <${address}@${domain}>`
      : `${address}@${domain}`;
    this.client = apiKey && apiKey !== 'disabled' ? new Resend(apiKey) : null;
    if (!this.client) {
      this.logger.warn(
        'Resend desabilitado (RESEND_API_KEY=disabled). EmailService virou no-op.',
      );
    } else {
      this.logger.log(
        `Resend ativo (from=${this.from}). Envios reais habilitados.`,
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
        // Sprint 227 (#5 bundle): expor codigo + nome do erro Resend
        // (ex "validation_error", "testing_emails_only", "domain_not_verified")
        // + Sentry capture — antes mensagem genérica dificultava diagnose
        // (user QA via "sem email" sem sinal no Render log).
        const err = result.error as {
          message: string;
          name?: string;
          statusCode?: number;
        };
        this.logger.error(
          `Resend falhou para ${masked}: [${err.name ?? 'unknown'} status=${err.statusCode ?? '?'}] ${err.message}`,
        );
        Sentry.captureMessage('Resend send failed', {
          level: 'error',
          tags: {
            email_kind: 'verification',
            resend_error_name: err.name ?? 'unknown',
          },
          extra: {
            masked_to: masked,
            from: this.from,
            status_code: err.statusCode,
            message: err.message,
          },
        });
        return;
      }
      this.logger.log(
        `verification email enviado para ${masked} (id=${result.data?.id ?? 'n/a'})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Resend exception para ${masked}: ${msg}`);
      Sentry.captureException(err, {
        tags: { email_kind: 'verification' },
        extra: { masked_to: masked, from: this.from },
      });
    }
  }

  async sendGraceReminder(payload: GraceReminderEmailPayload): Promise<void> {
    const localeCopy = GRACE_COPY[payload.locale] ?? GRACE_COPY.es;
    const copy = localeCopy[payload.stage];
    const html = this.renderGraceHtml(copy, payload);
    const text = this.renderGraceText(copy, payload);
    const masked = maskEmail(payload.to);

    if (!this.client) {
      this.logger.log(
        `[no-op] grace-reminder-${payload.stage} para ${masked} — link: ${payload.reactivateUrl}`,
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
          `Resend falhou (grace-${payload.stage}) para ${masked}: ${result.error.message}`,
        );
        return;
      }
      this.logger.log(
        `grace-reminder-${payload.stage} enviado para ${masked} (id=${result.data?.id ?? 'n/a'})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Resend exception (grace-${payload.stage}) para ${masked}: ${msg}`,
      );
    }
  }

  private renderGraceHtml(
    copy: GraceCopy,
    payload: GraceReminderEmailPayload,
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
          <a href="${escapeHtml(payload.reactivateUrl)}"
             style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
            ${escapeHtml(copy.cta)}
          </a>
        </p>
        <p style="margin:0 0 8px;font-size:13px;color:#666">${escapeHtml(copy.footer)}</p>
        <p style="margin:0;font-size:12px;color:#999;word-break:break-all">${escapeHtml(payload.reactivateUrl)}</p>
      </td></tr>
    </table>
  </body>
</html>`;
  }

  private renderGraceText(
    copy: GraceCopy,
    payload: GraceReminderEmailPayload,
  ): string {
    return `${copy.hello(payload.name)}\n\n${copy.body}\n\n${copy.cta}: ${payload.reactivateUrl}\n\n${copy.footer}\n`;
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
