import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import * as Sentry from '@sentry/node';
import { AppException } from '../../common/exceptions/app-exception';
import { ImportResponseDto } from './dtos/import-response.dto';
import { IMPORTS_QUEUE, ImportJob } from './imports.queue';
import { ImportsRepository } from './imports.repository';

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly repo: ImportsRepository,
    @InjectQueue(IMPORTS_QUEUE) private readonly queue: Queue<ImportJob>,
  ) {}

  async create(
    userId: string,
    zipPath: string,
    dryRun: boolean,
  ): Promise<ImportResponseDto> {
    const row = await this.repo.create({ userId, zipPath, dryRun });
    await this.queue.add(
      'parse',
      { importId: row.id, apply: !dryRun },
      { attempts: 1, removeOnComplete: 50, removeOnFail: 50 },
    );
    Sentry.addBreadcrumb({
      category: 'audit',
      level: 'info',
      message: 'import.enqueued',
      data: { userId, jobId: row.id, dryRun },
    });
    return ImportResponseDto.fromEntity(row);
  }

  async getStatus(
    userId: string,
    jobId: string,
  ): Promise<ImportResponseDto> {
    const row = await this.repo.findByIdForUser(jobId, userId);
    if (!row) {
      throw new AppException(
        'IMPORT.NOT_FOUND',
        `Import "${jobId}" not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    return ImportResponseDto.fromEntity(row);
  }

  async apply(userId: string, jobId: string): Promise<ImportResponseDto> {
    const row = await this.repo.findByIdForUser(jobId, userId);
    if (!row) {
      throw new AppException(
        'IMPORT.NOT_FOUND',
        `Import "${jobId}" not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.status !== 'ready_to_apply') {
      throw new AppException(
        'IMPORT.INVALID_STATE',
        `Import "${jobId}" está em "${row.status}", apply exige ready_to_apply`,
        HttpStatus.CONFLICT,
      );
    }
    const updated = await this.repo.updateStatus(jobId, 'applying');
    await this.queue.add(
      'apply',
      { importId: jobId, apply: true },
      { attempts: 1, removeOnComplete: 50, removeOnFail: 50 },
    );
    Sentry.addBreadcrumb({
      category: 'audit',
      level: 'info',
      message: 'import.apply_enqueued',
      data: { userId, jobId },
    });
    return ImportResponseDto.fromEntity(updated);
  }
}
