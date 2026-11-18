import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as fs from 'fs/promises';
import * as Sentry from '@sentry/node';
import { PrismaService } from '../../database/prisma.service';
import { ImportSummary } from './dtos/import-response.dto';
import { IMPORTS_QUEUE, ImportJob } from './imports.queue';
import { ImportsRepository } from './imports.repository';
import {
  AlertaRow,
  ExpenseRow,
  FavoritoRow,
  ListaRow,
  ParsedZip,
  ReviewRow,
  parseImportZip,
} from './imports-parse.util';

export { IMPORTS_QUEUE, ImportJob };

function emptySummary(): ImportSummary {
  return {
    added: {
      favoritos: 0,
      listas: 0,
      listaItems: 0,
      alertas: 0,
      reviews: 0,
      expenses: 0,
      expenseItems: 0,
    },
    skipped: {
      favoritos: 0,
      listas: 0,
      alertas: 0,
      reviews: 0,
      productsNotFound: 0,
    },
    errors: [],
  };
}

function pushErrors(
  summary: ImportSummary,
  file: string,
  errors: Array<{ line: number; message: string }>,
): void {
  for (const e of errors) {
    summary.errors.push({ file, line: e.line, message: e.message });
  }
}

@Processor(IMPORTS_QUEUE)
export class ImportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportsProcessor.name);

  constructor(
    private readonly repo: ImportsRepository,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<ImportJob>): Promise<void> {
    const { importId, apply } = job.data;
    this.logger.log(`Import ${importId} apply=${apply} start`);

    const row = await this.prisma.import.findUnique({
      where: { id: importId },
    });
    if (!row || !row.zipPath) {
      this.logger.error(`Import ${importId} sem zipPath — abortando`);
      return;
    }

    try {
      await this.repo.updateStatus(importId, apply ? 'applying' : 'parsing');
      const buf = await fs.readFile(row.zipPath);
      const parsed = await parseImportZip(buf);

      const summary = emptySummary();
      pushErrors(summary, 'favoritos.csv', parsed.favoritos.errors);
      pushErrors(summary, 'listas.csv', parsed.listas.errors);
      pushErrors(summary, 'alertas.csv', parsed.alertas.errors);
      pushErrors(summary, 'reviews.csv', parsed.reviews.errors);
      pushErrors(summary, 'expenses.csv', parsed.expenses.errors);

      // Produto lookup — set de ids existentes no catálogo (deletedAt=null)
      const allProductIds = new Set<string>();
      for (const r of parsed.favoritos.rows) allProductIds.add(r.productId);
      for (const r of parsed.listas.rows) {
        if (r.productId) allProductIds.add(r.productId);
      }
      for (const r of parsed.alertas.rows) allProductIds.add(r.productId);
      for (const r of parsed.reviews.rows) allProductIds.add(r.productId);

      const existingProducts = await this.prisma.product.findMany({
        where: {
          id: { in: Array.from(allProductIds) },
          deletedAt: null,
        },
        select: { id: true },
      });
      const validProducts = new Set(existingProducts.map((p) => p.id));

      await this.processFavoritos(
        row.userId,
        parsed.favoritos.rows,
        validProducts,
        summary,
        apply,
      );
      await this.processListas(
        row.userId,
        parsed.listas.rows,
        validProducts,
        summary,
        apply,
      );
      await this.processAlertas(
        row.userId,
        parsed.alertas.rows,
        validProducts,
        summary,
        apply,
      );
      await this.processReviews(
        row.userId,
        parsed.reviews.rows,
        validProducts,
        summary,
        apply,
      );
      await this.processExpenses(
        row.userId,
        parsed.expenses.rows,
        summary,
        apply,
      );

      const finalStatus = apply ? 'complete' : 'ready_to_apply';
      await this.repo.updateStatus(importId, finalStatus, { summary });

      Sentry.addBreadcrumb({
        category: 'audit',
        level: 'info',
        message: apply ? 'import.complete' : 'import.ready_to_apply',
        data: {
          userId: row.userId,
          jobId: importId,
          added: summary.added,
          skipped: summary.skipped,
          errors: summary.errors.length,
        },
      });
      this.logger.log(
        `[audit] UserDataImported userId=${row.userId} jobId=${importId} apply=${apply} ` +
          `added=${JSON.stringify(summary.added)} skipped=${JSON.stringify(summary.skipped)} errors=${summary.errors.length}`,
      );

      if (apply) {
        await this.cleanupZip(importId, row.zipPath);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Import ${importId} failed: ${message}`);
      await this.repo.updateStatus(importId, 'failed', {
        errorMessage: message,
      });
      Sentry.captureException(err, {
        tags: { feature: 'imports', jobId: importId },
      });
      if (row.zipPath) await this.cleanupZip(importId, row.zipPath);
    }
  }

  private async cleanupZip(importId: string, path: string): Promise<void> {
    try {
      await fs.unlink(path);
    } catch {
      /* ignore */
    }
    try {
      await this.repo.clearZipPath(importId);
    } catch {
      /* ignore */
    }
  }

  private async processFavoritos(
    userId: string,
    rows: FavoritoRow[],
    validProducts: Set<string>,
    summary: ImportSummary,
    apply: boolean,
  ): Promise<void> {
    const seenInDb = await this.prisma.favorite.findMany({
      where: { userId },
      select: { productId: true },
    });
    const existing = new Set(seenInDb.map((f) => f.productId));
    for (const r of rows) {
      if (!validProducts.has(r.productId)) {
        summary.skipped.productsNotFound++;
        continue;
      }
      if (existing.has(r.productId)) {
        summary.skipped.favoritos++;
        continue;
      }
      summary.added.favoritos++;
      if (apply) {
        await this.prisma.favorite.create({
          data: { userId, productId: r.productId },
        });
        existing.add(r.productId);
      }
    }
  }

  private async processListas(
    userId: string,
    rows: ListaRow[],
    validProducts: Set<string>,
    summary: ImportSummary,
    apply: boolean,
  ): Promise<void> {
    // Agrupa rows por listName (listas.csv emite 1 row por item)
    const grouped = new Map<string, ListaRow[]>();
    for (const r of rows) {
      const bucket = grouped.get(r.listName) ?? [];
      bucket.push(r);
      grouped.set(r.listName, bucket);
    }

    const userLists = await this.prisma.shoppingList.findMany({
      where: { userId, deletedAt: null },
      include: {
        items: { select: { productId: true } },
      },
    });
    const listsByName = new Map(userLists.map((l) => [l.name, l]));

    for (const [listName, items] of grouped) {
      let listId: string;
      const existingList = listsByName.get(listName);
      if (existingList) {
        summary.skipped.listas++;
        listId = existingList.id;
      } else {
        summary.added.listas++;
        if (apply) {
          const created = await this.prisma.shoppingList.create({
            data: { userId, name: listName },
          });
          listId = created.id;
          listsByName.set(listName, {
            ...created,
            items: [],
          });
        } else {
          listId = `preview-${listName}`;
        }
      }

      const existingItemProductIds = new Set(
        (existingList?.items ?? []).map((it) => it.productId),
      );

      for (const item of items) {
        if (!item.productId) continue;
        if (!validProducts.has(item.productId)) {
          summary.skipped.productsNotFound++;
          continue;
        }
        if (existingItemProductIds.has(item.productId)) continue;
        summary.added.listaItems++;
        existingItemProductIds.add(item.productId);
        if (apply) {
          await this.prisma.shoppingListItem.create({
            data: {
              listId,
              productId: item.productId,
              quantity: item.quantity ?? 1,
              position: item.position ?? 0,
            },
          });
        }
      }
    }
  }

  private async processAlertas(
    userId: string,
    rows: AlertaRow[],
    validProducts: Set<string>,
    summary: ImportSummary,
    apply: boolean,
  ): Promise<void> {
    const seen = await this.prisma.alert.findMany({
      where: { userId, deletedAt: null },
      select: { productId: true, type: true },
    });
    const existing = new Set(seen.map((a) => `${a.productId}:${a.type}`));
    for (const r of rows) {
      if (!validProducts.has(r.productId)) {
        summary.skipped.productsNotFound++;
        continue;
      }
      const key = `${r.productId}:${r.type}`;
      if (existing.has(key)) {
        summary.skipped.alertas++;
        continue;
      }
      summary.added.alertas++;
      existing.add(key);
      if (apply) {
        await this.prisma.alert.create({
          data: {
            userId,
            productId: r.productId,
            type: r.type,
            targetPrice: r.targetPrice ?? null,
            isActive: r.isActive,
          },
        });
      }
    }
  }

  private async processReviews(
    userId: string,
    rows: ReviewRow[],
    validProducts: Set<string>,
    summary: ImportSummary,
    apply: boolean,
  ): Promise<void> {
    const seen = await this.prisma.review.findMany({
      where: { userId, deletedAt: null },
      select: { productId: true },
    });
    const existing = new Set(seen.map((r) => r.productId));
    for (const r of rows) {
      if (!validProducts.has(r.productId)) {
        summary.skipped.productsNotFound++;
        continue;
      }
      if (existing.has(r.productId)) {
        summary.skipped.reviews++;
        continue;
      }
      summary.added.reviews++;
      existing.add(r.productId);
      if (apply) {
        await this.prisma.review.create({
          data: {
            userId,
            productId: r.productId,
            rating: r.rating,
            comment: r.comment,
          },
        });
      }
    }
  }

  private async processExpenses(
    userId: string,
    rows: ExpenseRow[],
    summary: ImportSummary,
    apply: boolean,
  ): Promise<void> {
    // Agrupa items por receiptId CSV (uma Receipt → N linhas)
    const grouped = new Map<string, ExpenseRow[]>();
    for (const r of rows) {
      const bucket = grouped.get(r.receiptId) ?? [];
      bucket.push(r);
      grouped.set(r.receiptId, bucket);
    }

    // Fuzzy dedupe: (userId, purchaseDate ±1h, total ±0.01). Carrega todas as
    // receipts do user pra range + total e compara in-memory (barato pra counts
    // realistas de export S91).
    const userReceipts = await this.prisma.receipt.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, purchaseDate: true, total: true },
    });

    for (const [, items] of grouped) {
      const head = items[0];
      if (!head.purchaseDate) {
        summary.errors.push({
          file: 'expenses.csv',
          line: 0,
          message: `receiptId=${head.receiptId} sem purchaseDate — skip grupo`,
        });
        continue;
      }
      const match = userReceipts.find((rc) => {
        if (!rc.purchaseDate) return false;
        const dt = Math.abs(
          rc.purchaseDate.getTime() - head.purchaseDate!.getTime(),
        );
        if (dt > 60 * 60 * 1000) return false;
        if (head.receiptTotal === null) return true;
        const rcTotal = rc.total === null ? null : Number(rc.total.toString());
        if (rcTotal === null) return true;
        return Math.abs(rcTotal - head.receiptTotal) < 0.01;
      });
      if (match) continue; // dedupe: receipt já existe

      summary.added.expenses++;
      let newReceiptId: string | null = null;
      if (apply) {
        const created = await this.prisma.receipt.create({
          data: {
            userId,
            supermarketSlug: head.supermarketSlug,
            purchaseDate: head.purchaseDate,
            total: head.receiptTotal ?? null,
            status: 'ready',
          },
        });
        newReceiptId = created.id;
      }

      let position = 0;
      for (const item of items) {
        const hasItem =
          item.itemName !== null &&
          item.quantity !== null &&
          item.unitPrice !== null &&
          item.itemTotal !== null;
        if (!hasItem) continue;
        summary.added.expenseItems++;
        if (apply && newReceiptId) {
          await this.prisma.receiptItem.create({
            data: {
              receiptId: newReceiptId,
              rawText: item.itemRawText ?? item.itemName ?? '',
              normalizedName: item.itemName ?? '',
              quantity: item.quantity ?? 1,
              unitPrice: item.unitPrice ?? 0,
              total: item.itemTotal ?? 0,
              position: position++,
            },
          });
        }
      }
    }
  }
}
