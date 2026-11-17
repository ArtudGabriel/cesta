// Sprint 94: constante isolada (mesmo pattern de user-cleanup.constants) pra
// permitir testes Jest sem transformar `@nestjs/bullmq` ESM.

export const GRACE_REMINDER_QUEUE = 'grace-reminder';

export interface GraceReminderScanJob {
  // Empty payload — cron dispara scan global diário.
  _?: never;
}
