# ADR 0026 — Backfill images cron via GitHub Actions

- **Data:** 2026-11-27
- **Sprint:** S216 (MVP-first, migrate off Render)
- **Status:** Aceito
- **Substitui parcialmente:** ADR 0025 opção B (flag env desabilitada)
- **Pré-requisito:** ADR 0025 (orçamento bandwidth Render)

## Contexto

ADR 0025 (S213) suspendeu `BACKFILL_IMAGES_ENABLED` em prod Render pra sair do
limite 5GB bandwidth mensal (Hobby). Uploads R2 custavam ~1GB/mês dentro do
runner Render — ~20% do orçamento. Decisão opt B (flag off) deixou catálogo
sem crescimento de imagens até criarmos infra externa.

S216 fecha o gap introduzindo a **opt A** diferida: cron nightly em GitHub
Actions, consumindo a banda do runner GitHub em vez da do Render. Objetivo
MVP: catálogo com fotos cresce nightly sem re-ativar outbound Render.

## Decisão

1. **Workflow `.github/workflows/backfill-images.yml`** com schedule `0 3 * * *`
   (03:00 UTC = 04:00 CET / 05:00 CEST, Europe/Madrid low-traffic window) +
   `workflow_dispatch` manual com input `limit` default 100.

2. **Script standalone `cesta-api/scripts/backfill-images-standalone.mjs`**
   bootstrap-a `PrismaClient` + `BackfillImagesRepository` +
   `R2StorageService` + `BackfillImagesService` via `dist/` (requer
   `npm run build` antes). Reusa 100% da lógica existente (ADR 0008 + ADR 0010).

3. **Rate limit / batch size.** Default `--limit=100` produtos por run; cron
   nightly 30 runs/mês → ~3000 produtos/mês cobertos. Service aplica jitter
   300-1200ms entre chamadas OpenFoodFacts (já embedded em
   `BackfillImagesService.resolveOpenFoodFacts`). Suficiente pra respeitar
   rate limits OFF (<1req/s).

4. **GitHub Actions free tier budget.** 2000min/mês runners Linux. Cada run
   estimado 3-5min (checkout + setup Node + `npm ci` cache hit + `npm run
   build` + script). 30 runs × 5min = 150min/mês = 7.5% orçamento. Folga pra
   CI + E2E dos outros workflows.

5. **Flag Render permanece `false`.** `BACKFILL_IMAGES_ENABLED` segue default
   false em prod; GHA chama `service.scanAndBackfill()` direto sem BullMQ
   scheduler envolvido. Dois caminhos independentes — nenhuma migração de
   estado necessária.

6. **Secrets.** Documentados em `docs/ops/github-actions-secrets.md`.
   `DATABASE_URL` + `R2_*` copiados do `.env` prod (Render dashboard + Neon
   console + Cloudflare R2 token).

## Trade-offs aceitos

- **Latência imagem new-product até 24h.** Produto recém-syncado espera o cron
  nightly. Aceitável MVP — catálogo cresce diário, não minuto-a-minuto.
- **Dependência GitHub free tier.** Se passar de 2000min/mês, workflow pausa
  até próximo mês. Mitigation: `workflow_dispatch` on-demand + alerta manual
  no dashboard Actions quando passar 1500min.
- **Build dist cada run.** ~1-2min extra vs rodar ts-node direto. Troca por
  menos surface de erro (TypeScript errors travam build, não runtime).
- **Dois dispatch paths pro backfill.** Cron GHA + `from-source` enqueue pelo
  CatalogSync (em prod gated off). Pós-reativação prod, from-source voltará.

## Alternativas descartadas

- **ts-node direto no workflow.** Economiza build mas aceita decorators +
  reflect-metadata overhead toda execução. Build cacheado é mais previsível.
- **Executar via Render cron job dedicado.** Volta a consumir Render bandwidth
  — anula ADR 0025.
- **Cloudflare Workers Cron.** Overhead de rewrite completo pra Workers
  runtime (sem Prisma Node-native) — fora do scope MVP.
- **Vercel Cron Jobs.** Hobby limita 2 crons/projeto; `cesta-web` não deveria
  carregar lógica catalog-sync de backend.

## Rollback

Se rate limit OpenFoodFacts bater ou R2 quota PUTs for problema:

1. Workflow `workflow_dispatch` manual com `--limit=10` (dry-run reduzido).
2. Desabilitar schedule comentando linhas `on.schedule.*` no yml.
3. Último recurso: re-enable BullMQ scheduler Render (flip
   `BACKFILL_IMAGES_ENABLED=true` + aceitar ~1GB/mês outbound Render).

## Métricas de sucesso

- 1 semana pós-merge: 7 runs nightly OK sem failures (checar `gh run list`).
- % Product.imageUrl populated cresce nightly (monitorar via SQL
  `SELECT COUNT(*) FROM "Product" WHERE "imageUrl" IS NOT NULL / COUNT(*)`).
- Render monthly bandwidth continua <4GB/mês.
