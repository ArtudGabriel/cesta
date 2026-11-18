import { Job } from 'bullmq';
import * as fs from 'fs/promises';
import * as JSZip from 'jszip';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  buildAlertasCsv,
  buildExpensesCsv,
  buildFavoritosCsv,
  buildListasCsv,
  buildReviewsCsv,
} from '../users/users-export.util';
import { ImportsProcessor } from './imports.processor';
import { ImportsRepository } from './imports.repository';
import { ImportJob } from './imports.queue';

jest.mock('fs/promises');
jest.mock('@sentry/node', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

const CUID_A = 'ckimportaaaaaaaaaaaaaaaaaa';

async function buildMinimalZip(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    'favoritos.csv',
    buildFavoritosCsv([
      { id: 'f1', productId: CUID_A, product: { name: 'Leche' }, createdAt: new Date() },
    ]),
  );
  zip.file('listas.csv', buildListasCsv([]));
  zip.file('alertas.csv', buildAlertasCsv([]));
  zip.file('reviews.csv', buildReviewsCsv([]));
  zip.file('expenses.csv', buildExpensesCsv([]));
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('ImportsProcessor (S102)', () => {
  const repo = {
    updateStatus: jest.fn(),
    clearZipPath: jest.fn(),
  };
  const prisma = {
    import: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
    favorite: { findMany: jest.fn(), create: jest.fn() },
    shoppingList: { findMany: jest.fn(), create: jest.fn() },
    shoppingListItem: { create: jest.fn() },
    alert: { findMany: jest.fn(), create: jest.fn() },
    review: { findMany: jest.fn(), create: jest.fn() },
    receipt: { findMany: jest.fn(), create: jest.fn() },
    receiptItem: { create: jest.fn() },
  };

  let processor: ImportsProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const audit = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    processor = new ImportsProcessor(
      repo as unknown as ImportsRepository,
      prisma as unknown as PrismaService,
      audit,
    );
    prisma.import.findUnique.mockResolvedValue({
      id: 'imp1',
      userId: 'u1',
      zipPath: '/tmp/x.zip',
    });
    const buf = await buildMinimalZip();
    (fs.readFile as jest.Mock).mockResolvedValue(buf);
    prisma.product.findMany.mockResolvedValue([{ id: CUID_A }]);
    prisma.favorite.findMany.mockResolvedValue([]);
    prisma.shoppingList.findMany.mockResolvedValue([]);
    prisma.alert.findMany.mockResolvedValue([]);
    prisma.review.findMany.mockResolvedValue([]);
    prisma.receipt.findMany.mockResolvedValue([]);
  });

  function mkJob(apply: boolean): Job<ImportJob> {
    return { data: { importId: 'imp1', apply } } as unknown as Job<ImportJob>;
  }

  it('dry-run does not write and transitions to ready_to_apply', async () => {
    await processor.process(mkJob(false));
    expect(prisma.favorite.create).not.toHaveBeenCalled();
    const finalCall = repo.updateStatus.mock.calls.at(-1);
    expect(finalCall?.[0]).toBe('imp1');
    expect(finalCall?.[1]).toBe('ready_to_apply');
    const summary = finalCall?.[2].summary;
    expect(summary.added.favoritos).toBe(1);
  });

  it('apply writes once and is idempotent on retry', async () => {
    await processor.process(mkJob(true));
    expect(prisma.favorite.create).toHaveBeenCalledTimes(1);

    // Simulate retry: favorite now exists in DB.
    prisma.favorite.findMany.mockResolvedValue([{ productId: CUID_A }]);
    prisma.favorite.create.mockClear();
    repo.updateStatus.mockClear();

    await processor.process(mkJob(true));
    expect(prisma.favorite.create).not.toHaveBeenCalled();
    const finalCall = repo.updateStatus.mock.calls.at(-1);
    expect(finalCall?.[1]).toBe('complete');
    expect(finalCall?.[2].summary.added.favoritos).toBe(0);
    expect(finalCall?.[2].summary.skipped.favoritos).toBe(1);
  });

  it('marks failed when zip is malformed', async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('not a zip'));
    await processor.process(mkJob(false));
    const finalCall = repo.updateStatus.mock.calls.at(-1);
    expect(finalCall?.[1]).toBe('failed');
    expect(finalCall?.[2].errorMessage).toMatch(/MALFORMED_ZIP/);
  });
});
