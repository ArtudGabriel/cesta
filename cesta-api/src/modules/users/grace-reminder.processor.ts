import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { EmailService } from '../email/email.service';
import {
  GRACE_REMINDER_QUEUE,
  GraceReminderScanJob,
} from './grace-reminder.constants';
import { UsersRepository } from './users.repository';

export { GRACE_REMINDER_QUEUE } from './grace-reminder.constants';
export type { GraceReminderScanJob } from './grace-reminder.constants';

const GRACE_PERIOD_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Idempotent guard: janela mínima entre envios pro mesmo user. Cron roda
// 09:00 UTC diário, então mesmo em redeploy no mesmo dia (duas execuções)
// o segundo scan vê graceReminderSentAt recente e pula o user.
const DEDUPE_WINDOW_MS = 23 * 60 * 60 * 1000;

/**
 * Sprint 94: cron diário envia email aviso aos users soft-deleted quando
 * restam 7d ou 1d pro hard-delete. CTA leva ao /login que mostra banner
 * reativar conta (Sprint 90). Guards:
 *   - só users com email não-nulo (phone-only ainda não tem canal email)
 *   - só stages exatos daysRemaining == 7 ou == 1
 *   - skip se último reminder foi há <23h (idempotent entre reruns)
 */
@Processor(GRACE_REMINDER_QUEUE)
export class GraceReminderProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(GraceReminderProcessor.name);

  constructor(
    private readonly repo: UsersRepository,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    @InjectQueue(GRACE_REMINDER_QUEUE)
    private readonly queue: Queue<GraceReminderScanJob>,
  ) {
    super();
  }

  onModuleInit(): void {
    setImmediate(() => void this.scheduleCron());
  }

  private async scheduleCron(): Promise<void> {
    const hour = Number(
      this.config.get<number | string>('CRON_GRACE_REMINDER_HOUR', 9),
    );
    const cron = `0 ${hour} * * *`;
    try {
      await this.queue.add(
        'reminder-scan',
        {},
        {
          jobId: 'cron:grace-reminder',
          repeat: { pattern: cron, tz: 'UTC' },
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
      this.logger.log(`GraceReminder cron scheduled "${cron}" UTC`);
    } catch (err) {
      this.logger.error(
        `GraceReminder cron schedule failed: ${(err as Error).message}`,
      );
    }
  }

  async process(job: Job<GraceReminderScanJob>): Promise<void> {
    if (job.name !== 'reminder-scan') return;
    const now = new Date();
    const users = await this.repo.findSoftDeletedForGraceReminder();
    const baseUrl = this.config.get<string>(
      'EMAIL_VERIFY_BASE_URL',
      'http://localhost:3000',
    );
    const reactivateUrl = `${baseUrl.replace(/\/+$/, '')}/login`;

    let sent = 0;
    for (const user of users) {
      if (!user.deletedAt || !user.email) continue;

      const elapsedDays = Math.floor(
        (now.getTime() - user.deletedAt.getTime()) / MS_PER_DAY,
      );
      const daysRemaining = GRACE_PERIOD_DAYS - elapsedDays;
      const stage: '7d' | '1d' | null =
        daysRemaining === 7 ? '7d' : daysRemaining === 1 ? '1d' : null;
      if (!stage) continue;

      if (user.graceReminderSentAt) {
        const diffMs = now.getTime() - user.graceReminderSentAt.getTime();
        if (diffMs < DEDUPE_WINDOW_MS) continue;
      }

      const locale: 'es' | 'pt-BR' =
        user.locale === 'pt-BR' ? 'pt-BR' : 'es';
      await this.email.sendGraceReminder({
        to: user.email,
        name: user.name,
        locale,
        stage,
        reactivateUrl,
      });
      await this.repo.markGraceReminderSent(user.id, now);
      sent++;
    }

    this.logger.log(
      `GraceReminder scan: ${users.length} candidatos, ${sent} emails enviados`,
    );
  }
}
