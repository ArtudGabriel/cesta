import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  HardDeleteJob,
  USER_CLEANUP_QUEUE,
} from './user-cleanup.constants';
import { UsersRepository } from './users.repository';

export { USER_CLEANUP_QUEUE } from './user-cleanup.constants';
export type { HardDeleteJob } from './user-cleanup.constants';

const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Sprint 64 GDPR Art.17 — executa hard-delete após grace period 30d.
 * Safety checks evitam apagar user se:
 *   - não existe (idempotência)
 *   - não está soft-deleted (reativação possível via futuro fluxo recovery)
 *   - grace não elapsed (job disparado cedo por engano)
 * Cascade FK em 11 relações User (Sprints 3/15/41) apaga tudo em uma
 * transação implícita via Prisma `user.delete`.
 */
@Processor(USER_CLEANUP_QUEUE)
export class UserCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(UserCleanupProcessor.name);

  constructor(private readonly repo: UsersRepository) {
    super();
  }

  async process(job: Job<HardDeleteJob>): Promise<void> {
    if (job.name !== 'hard-delete') return;
    const { userId } = job.data;

    const user = await this.repo.findByIdIgnoreDeleted(userId);
    if (!user) {
      this.logger.warn(
        `UserCleanup skip: user ${userId} not found (idempotent).`,
      );
      return;
    }
    if (!user.deletedAt) {
      this.logger.warn(
        `UserCleanup abort: user ${userId} not soft-deleted — reativação possível.`,
      );
      return;
    }
    const elapsed = Date.now() - user.deletedAt.getTime();
    if (elapsed < GRACE_PERIOD_MS) {
      this.logger.warn(
        `UserCleanup abort: grace period ${elapsed}ms < ${GRACE_PERIOD_MS}ms.`,
      );
      return;
    }

    await this.repo.hardDelete(userId);
    this.logger.log(`UserCleanup done: user ${userId} hard-deleted.`);
  }
}
