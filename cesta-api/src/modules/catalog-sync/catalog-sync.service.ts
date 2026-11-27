import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Queue } from 'bullmq';
import { AppException } from '../../common/exceptions/app-exception';
import { isBackfillImagesEnabled } from '../../common/config/is-backfill-enabled';
import { RevalidateService } from '../../common/revalidate/revalidate.service';
import {
  PRICE_ALERTS_QUEUE,
  PriceAlertCheckJob,
} from '../alerts/alerts.processor';
import {
  STORAGE_SERVICE,
  StorageService,
} from '../storage/storage.service.interface';
import {
  BACKFILL_IMAGES_QUEUE,
  BackfillImagesJob,
} from './backfill-images.processor';
import { CatalogSyncRepository } from './catalog-sync.repository';
import { AlcampoAdapter } from './adapters/alcampo.adapter';
import { AldiAdapter } from './adapters/aldi.adapter';
import { CarrefourAdapter } from './adapters/carrefour.adapter';
import { DiaAdapter } from './adapters/dia.adapter';
import { EroskiAdapter } from './adapters/eroski.adapter';
import { FroizAdapter } from './adapters/froiz.adapter';
import { LidlAdapter } from './adapters/lidl.adapter';
import { MercadonaAdapter } from './adapters/mercadona.adapter';
import type { Product } from '@prisma/client';
import type {
  RawProduct,
  SupermarketAdapter,
} from './adapters/supermarket-adapter.interface';
import { resolveCategorySlug } from './utils/category-resolver';
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
  // Sprint 228 G2 (ADR 0037): duplicados reconciliados via canonicalProductId.
  itemsMergedCanonical: number;
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
    eroski: EroskiAdapter,
    froiz: FroizAdapter,
    lidl: LidlAdapter,
    aldi: AldiAdapter,
    @InjectQueue(PRICE_ALERTS_QUEUE)
    private readonly alertsQueue: Queue<PriceAlertCheckJob>,
    @InjectQueue(BACKFILL_IMAGES_QUEUE)
    private readonly backfillImagesQueue: Queue<BackfillImagesJob>,
    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,
  ) {
    this.adapters = new Map<string, SupermarketAdapter>([
      [mercadona.slug, mercadona],
      [carrefour.slug, carrefour],
      [alcampo.slug, alcampo],
      [dia.slug, dia],
      [eroski.slug, eroski],
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
      throw new AppException(
        'CATALOG_SYNC.ADAPTER_NOT_REGISTERED',
        `Adapter "${supermarketSlug}" não registrado`,
        HttpStatus.NOT_FOUND,
        { supermarketSlug },
      );

    // Sprint 124: adapters pós-seed expõem definition → auto-upsert Supermarket
    // antes de validar existência (Eroski entrou em S124 sem re-rodar seed prod).
    if (adapter.definition) {
      await this.repo.ensureSupermarket(adapter.definition);
    }

    const supermarket = await this.repo.findSupermarketBySlug(supermarketSlug);
    if (!supermarket)
      throw new AppException(
        'CATALOG_SYNC.SUPERMARKET_NOT_FOUND',
        `Supermercado "${supermarketSlug}" não cadastrado`,
        HttpStatus.NOT_FOUND,
        { supermarketSlug },
      );

    const run = await this.repo.createRun(supermarketSlug);
    const stats = {
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsCandidate: 0,
      itemsFailed: 0,
      itemsMergedCanonical: 0,
    };
    const updatedProductIds = new Set<string>();

    try {
      this.logger.log(`Sync ${supermarketSlug}: run=${run.id} fetching adapter...`);
      const raws = await Sentry.startSpan(
        {
          name: `catalog-sync.${supermarketSlug}`,
          op: 'http.client',
        },
        () => adapter.fetchProducts(),
      );
      this.logger.log(`Sync ${supermarketSlug}: adapter retornou ${raws.length} raw products`);

      // Sprint 142: cache Category slug→id uma vez por run.
      const categoryIdMap = await this.repo.loadCategoryIdMap();

      for (const raw of raws) {
        stats.itemsProcessed += 1;
        try {
          const matched = await this.matchProduct(raw);
          let product = matched.product;
          const resolvedSlug = resolveCategorySlug(raw.name, raw.categoryHint);
          const resolvedCategoryId = resolvedSlug
            ? categoryIdMap.get(resolvedSlug) ?? null
            : null;
          const normalizedForRaw = slugifyName(`${raw.brand ?? ''} ${raw.name}`);
          // Sprint 116: adapter oficial é fonte confiável → se o Product
          // não existe no catálogo, criamos em vez de só registrar candidato.
          // S115 revelou que 100% dos 4620 produtos da Mercadona viravam
          // candidate porque o catálogo vinha vazio (EAN null + sem match
          // por slug). Mantemos o pipeline de candidate apenas para
          // adapters crowdsourced (futuro).
          if (!product) {
            product = await this.repo.createProductFromRaw(
              raw,
              normalizedForRaw,
              resolvedCategoryId,
            );
          } else if (!product.categoryId && resolvedCategoryId) {
            // Produto legacy sem categoria: atualiza se adapter resolve.
            await this.repo.updateCategoryId(product.id, resolvedCategoryId);
            product = { ...product, categoryId: resolvedCategoryId };
          }

          // Sprint 228 G2 (ADR 0037 + Boss guards 2026-11-27): matching
          // canônico cross-mercado por EAN. Match veio via EAN exato →
          // marca Product duplicado (ean=null · mesmo normalized_name)
          // como `canonicalProductId = canonical.id`. NÃO deleta duplicate
          // nem price do duplicate (preserva FKs de favorites/lists/alerts).
          // UI filtra `canonicalProductId IS NULL` em G4.
          if (matched.viaEan) {
            const { linked } = await this.repo.linkSupermarketDuplicate({
              canonicalId: product.id,
              normalizedName: normalizedForRaw,
            });
            if (linked) stats.itemsMergedCanonical += 1;
          }

          // Sprint 224 (MVP Bloco 2): mantém sourceImageUrl atualizado pra
          // produtos existentes. Re-sync nightly rebuilda a pista pra legacy
          // (coluna adicionada S224 — produtos criados antes têm NULL).
          // Backfill scan usa sourceImageUrl direto (sem depender de EAN+OFF).
          if (
            raw.imageUrl &&
            product.sourceImageUrl !== raw.imageUrl
          ) {
            await this.repo.updateSourceImageUrl(product.id, raw.imageUrl);
            product = { ...product, sourceImageUrl: raw.imageUrl };
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

          // Sprint 133/135: pipeline storage-only. Enfileira backfill se o
          // adapter trouxe imageUrl E o Product ainda não aponta pro storage
          // gerenciado (R2). Dedupe via jobId.
          // Sprint 213 (ADR 0025): gated por BACKFILL_IMAGES_ENABLED env.
          // Default disabled em prod Render enquanto bandwidth outbound
          // está sob pressão. Habilitar via GitHub Actions cron OU script local.
          if (
            isBackfillImagesEnabled(process.env.BACKFILL_IMAGES_ENABLED) &&
            raw.imageUrl &&
            !this.storage.isManagedUrl(product.imageUrl)
          ) {
            await this.backfillImagesQueue.add(
              'from-source',
              {
                kind: 'from-source',
                productId: product.id,
                sourceUrl: raw.imageUrl,
              },
              {
                jobId: `img-${product.id}`,
                removeOnComplete: 200,
                removeOnFail: 50,
              },
            );
          }

          // Enfileira verificação de alertas (dedupe via jobId)
          await this.alertsQueue.add(
            'check',
            { productId: product.id, supermarketId: supermarket.id },
            {
              jobId: `${product.id}-${supermarket.id}`,
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

      // Sprint 134-r P2: status='failed' por 0 itens precisa de errorMessage
      // diagnóstico — adapter retornou array vazio sem throw (ex: todas
      // queries falharam mas adapter engoliu). Sem isso, QA fica cego.
      const errorMessage =
        status === 'failed'
          ? `Adapter ${supermarketSlug} retornou 0 produtos (nenhuma exceção lançada — ver logs do adapter para causa)`
          : undefined;

      await this.repo.updateRun(run.id, {
        ...stats,
        status,
        errorMessage,
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

  // Sprint 228 G2: retorno carrega flag viaEan pra sinalizar quando o
  // match veio do catálogo canônico (gate pra linkSupermarketDuplicate).
  private async matchProduct(
    raw: RawProduct,
  ): Promise<{ product: Product | null; viaEan: boolean }> {
    if (raw.ean) {
      const byEan = await this.repo.findProductByEan(raw.ean);
      if (byEan) return { product: byEan, viaEan: true };
    }
    const normalized = slugifyName(`${raw.brand ?? ''} ${raw.name}`);
    const byName = await this.repo.findProductByNormalizedName(normalized);
    if (byName) return { product: byName, viaEan: false };
    return { product: null, viaEan: false };
  }
}
