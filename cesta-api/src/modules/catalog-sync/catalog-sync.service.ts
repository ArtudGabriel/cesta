import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RevalidateService } from '../../common/revalidate/revalidate.service';
import {
  PRICE_ALERTS_QUEUE,
  PriceAlertCheckJob,
} from '../alerts/alerts.processor';
import { CatalogSyncRepository } from './catalog-sync.repository';
import { AlcampoAdapter } from './adapters/alcampo.adapter';
import { AldiAdapter } from './adapters/aldi.adapter';
import { CarrefourAdapter } from './adapters/carrefour.adapter';
import { DiaAdapter } from './adapters/dia.adapter';
import { FroizAdapter } from './adapters/froiz.adapter';
import { LidlAdapter } from './adapters/lidl.adapter';
import { MercadonaAdapter } from './adapters/mercadona.adapter';
import type {
  RawProduct,
  SupermarketAdapter,
} from './adapters/supermarket-adapter.interface';
import { slugifyName } from './utils/slugify';

export interface SyncResult {
  runId: string;
  supermarketSlug: string;
  status: 'success' | 'partial' | 'failed';
  itemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsCandidate: number;
  itemsFailed: number;
}

@Injectable()
export class CatalogSyncService {
  private readonly logger = new Logger(CatalogSyncService.name);
  private readonly adapters: Map<string, SupermarketAdapter>;

  constructor(
    private readonly repo: CatalogSyncRepository,
    private readonly revalidate: RevalidateService,
    mercadona: MercadonaAdapter,
    carrefour: CarrefourAdapter,
    alcampo: AlcampoAdapter,
    dia: DiaAdapter,
    froiz: FroizAdapter,
    lidl: LidlAdapter,
    aldi: AldiAdapter,
    @InjectQueue(PRICE_ALERTS_QUEUE)
    private readonly alertsQueue: Queue<PriceAlertCheckJob>,
  ) {
    this.adapters = new Map<string, SupermarketAdapter>([
      [mercadona.slug, mercadona],
      [carrefour.slug, carrefour],
      [alcampo.slug, alcampo],
      [dia.slug, dia],
      [froiz.slug, froiz],
      [lidl.slug, lidl],
      [aldi.slug, aldi],
    ]);
  }

  listAdapters(): string[] {
    return [...this.adapters.keys()];
  }

  async runFor(supermarketSlug: string): Promise<SyncResult> {
    const adapter = this.adapters.get(supermarketSlug);
    if (!adapter)
      throw new NotFoundException(`Adapter "${supermarketSlug}" não registrado`);

    const supermarket = await this.repo.findSupermarketBySlug(supermarketSlug);
    if (!supermarket)
      throw new NotFoundException(`Supermercado "${supermarketSlug}" não cadastrado`);

    const run = await this.repo.createRun(supermarketSlug);
    const stats = {
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsCandidate: 0,
      itemsFailed: 0,
    };
    const updatedProductIds = new Set<string>();

    try {
      const raws = await adapter.fetchProducts();

      for (const raw of raws) {
        stats.itemsProcessed += 1;
        try {
          const product = await this.matchProduct(raw);
          if (!product) {
            await this.repo.upsertCandidate({
              rawName: raw.name,
              normalizedName: slugifyName(`${raw.brand ?? ''} ${raw.name}`),
              brand: raw.brand,
              ean: raw.ean,
              supermarketSlug,
              reportedPrice: raw.price,
              packageHint: `${raw.packageSize} ${raw.packageUnit}`,
              categoryHint: raw.categoryHint,
            });
            stats.itemsCandidate += 1;
            continue;
          }

          const { created } = await this.repo.upsertPrice({
            productId: product.id,
            supermarketId: supermarket.id,
            price: raw.price,
            previousPrice: raw.previousPrice ?? null,
            onPromotion: raw.onPromotion,
            isAvailable: raw.isAvailable,
            source: 'official_api',
          });

          if (created) stats.itemsCreated += 1;
          else stats.itemsUpdated += 1;
          updatedProductIds.add(product.id);

          // Enfileira verificação de alertas (dedupe via jobId)
          await this.alertsQueue.add(
            'check',
            { productId: product.id, supermarketId: supermarket.id },
            {
              jobId: `${product.id}:${supermarket.id}`,
              removeOnComplete: 100,
              removeOnFail: 50,
            },
          );
        } catch (error) {
          stats.itemsFailed += 1;
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Falha ao processar ${raw.externalId}: ${message}`);
        }
      }

      // Marca como stale preços que não foram atualizados neste run
      // (threshold = 1h antes do início do run para tolerar jitter)
      const staleThreshold = new Date(run.startedAt.getTime() - 60 * 60 * 1000);
      await this.repo.markStaleForSupermarket(supermarket.id, staleThreshold);

      const status =
        stats.itemsFailed > 0 && stats.itemsProcessed > 0
          ? 'partial'
          : stats.itemsProcessed === 0
            ? 'failed'
            : 'success';

      await this.repo.updateRun(run.id, {
        ...stats,
        status,
        finishedAt: new Date(),
      });

      this.logger.log(
        `Sync ${supermarketSlug}: ${stats.itemsProcessed} processados, ${stats.itemsCreated} criados, ${stats.itemsUpdated} atualizados, ${stats.itemsCandidate} candidatos, ${stats.itemsFailed} falhas`,
      );

      // Invalida cache SSR pros produtos cujo preço mudou. Fire-and-forget:
      // RevalidateService não bloqueia (sem await), timeout interno 5s.
      this.revalidate.revalidateProducts([...updatedProductIds]);

      return {
        runId: run.id,
        supermarketSlug,
        status: status as SyncResult['status'],
        ...stats,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Sync ${supermarketSlug} falhou: ${message}`);
      await this.repo.updateRun(run.id, {
        ...stats,
        status: 'failed',
        errorMessage: message,
        finishedAt: new Date(),
      });
      throw error;
    }
  }

  listRuns(supermarketSlug?: string) {
    return this.repo.listRuns(supermarketSlug);
  }

  private async matchProduct(raw: RawProduct) {
    if (raw.ean) {
      const byEan = await this.repo.findProductByEan(raw.ean);
      if (byEan) return byEan;
    }
    const normalized = slugifyName(`${raw.brand ?? ''} ${raw.name}`);
    const byName = await this.repo.findProductByNormalizedName(normalized);
    if (byName) return byName;
    return null;
  }
}
