# ADR 0033 — LIDL + Aldi daily catalog-sync cron (MVP Bloco 2 fotos)

- **Data:** 2026-11-27
- **Sprint:** S225 (MVP Bloco 2 fotos · Aldi + LIDL completion)
- **Status:** Aceito
- **Estende:** ADR 0032 (sourceImageUrl path), ADR 0025 (bandwidth budget)

## Contexto

S224 (ADR 0032) adicionou coluna `Product.sourceImageUrl` + path
`CatalogSyncRepository.updateSourceImageUrl` que popula o campo no **próximo
ciclo catalog-sync** por adapter. Mercadona + DIA + Eroski rodam cron diário;
LIDL + Aldi + Froiz rodam cron semanal (terça às 06:00/07:00 CET).

Baseline empírico 2026-11-27 pós-S224 merge:

| slug      | total | com_imagem | cobertura | cron          | last_sync pós-S224? |
| --------- | ----- | ---------- | --------- | ------------- | ------------------- |
| mercadona | 4074  | 4046       | 99.3%     | 0 3 * * *     | sim (304 sources)   |
| dia       | 3097  | 3002       | 96.9%     | 30 4 * * *    | pending next cycle  |
| lidl      | 1227  | 1003       | 81.7%     | 0 6 * * 2     | pending (+4 dias)   |
| aldi      | 375   | 336        | 89.6%     | 0 7 * * 2     | pending (+4 dias)   |
| eroski    | 746   | 0          | 0.0%      | 0 5 * * *     | pending next cycle  |
| froiz     | 366   | 0          | 0.0%      | 0 6 * * 2     | pending (+4 dias)   |

Breakdown Aldi + LIDL por fonte (query live 2026-11-27 pós-merge):

| slug | total | r2_uploaded | has_source | adapter_miss | legacy_backfilled |
| ---- | ----- | ----------- | ---------- | ------------ | ----------------- |
| aldi | 375   | 336         | 0          | 39           | 336               |
| lidl | 1227  | 1003        | 0          | 224          | 1003              |

`has_source=0` nos dois porque último sync (LIDL 2026-11-27 11:29 CET;
Aldi 2026-11-26 12:45 CET) foi **antes** do deploy S224 (prod ~12:00 CET).
Próxima cron Tuesday-weekly = 2026-12-01 → ~4 dias de atraso empírico pra
medir delta da fix ADR 0032 em adapters high-volume (LIDL 1227 · Aldi 375).

Probe live 2026-11-27 LIDL `/q/search?q=leche`: **48/48 segments** com
`"image":"..."` capturado pela regex do adapter. Aldi extrai via JSON-LD
`Product.image[0]` SSR em cada página — taxa histórica ~90%. Em ambos
adapters, a próxima rodada deve popular `sourceImageUrl` pra ~90-100% dos
produtos touched.

## Decisão

**Promover LIDL e Aldi de cron Tuesday-weekly para daily** em
`cesta-api/src/modules/catalog-sync/catalog-sync.processor.ts` (FULL_SCHEDULE):

```diff
-  { slug: 'lidl', cron: '0 6 * * 2' },
-  { slug: 'aldi', cron: '0 7 * * 2' },
+  { slug: 'lidl', cron: '0 6 * * *' },
+  { slug: 'aldi', cron: '0 7 * * *' },
```

Froiz mantém `0 6 * * 2` — fora do escopo S225 (empírico pós-próxima
Tuesday revela se ADR 0032 cobre Froiz 0%→≥95%; se não, ADR próprio).

Replace in place (sem flag paralelo, sem rollback silencioso). Jest spec
nova `catalog-sync.processor.spec.ts` trava a cadência.

## Trade-offs aceitos

- **Bandwidth outbound Render.** Adapter faz HTTP outbound pra lidl.es e
  aldi.es; cada run é ~500B/request × (81 LIDL queries + ~300 Aldi detail
  pages) = ~190KB por run. Daily × 30 = ~5.7MB/mês. Vs weekly ~800KB/mês
  →  delta ~4.9MB/mês. Dentro do orçamento ADR 0025 (<4GB; atual 2.55GB).
- **Load lidl.es / aldi.es.** 81 queries/dia LIDL e ~300 pages/dia Aldi.
  Ambos endpoints públicos SSR; `politeFetch` mantém jitter 1-7s entre
  requests; nenhum anti-bot aparente (S126 LIDL · S219 Aldi). Volume
  baixo pra ser significativo contra CDN desses sites.
- **Cron conflita com GHA backfill-images 03:00 UTC = 04:00 CET.** LIDL
  sync 06:00 CET e Aldi 07:00 CET rodam **depois** do backfill cron.
  Primeiro ciclo sourceImageUrl→R2 → one-day lag: Dia D LIDL sync
  popula sourceImageUrl; Dia D+1 03:00 UTC GHA backfill baixa + sobe R2 +
  atualiza `imageUrl`. Delta empírico ≥95% esperado em **D+2** (2 ciclos),
  não D+1.

## Consequências

- Imagem coverage LIDL 81.7%→≥95% esperado em 48h (2026-11-29 07:00 CET).
- Imagem coverage Aldi 89.6%→≥95% esperado em 48h (2026-11-29 07:00 CET).
- Froiz 0% permanece até 2026-12-01 06:00 CET (Tuesday).
- CHANGELOG + memory [[project-image-coverage]] + [[project-aldi-adapter-architecture]] + [[project-lidl-adapter-architecture]] atualizados S225.

## Alternativas consideradas

1. **Script admin one-shot (`scripts/sync-aldi.ts` + `scripts/sync-lidl.ts`).**
   Rejeitado: requer trigger manual, duplica upsert path do CatalogSyncService
   (anti-pattern DRY), e scripts existentes (ex: `sync-eroski.ts`) não
   populam `sourceImageUrl` — bug latente. Fix do script fica follow-up.
2. **GHA workflow_dispatch pra catalog-sync.** Rejeitado: adiciona nova
   infra reutilizando bootstrap CJS unwrap; o cron BullMQ interno já é
   suficiente — basta cadência adequada.
3. **Promover Froiz também.** Rejeitado: fora de escopo S225 (sprint spec
   Boss diz "Fotos Aldi + LIDL"). Froiz vira sprint própria se 0% persistir.

## Reversibility

Revert a 2 linhas em `catalog-sync.processor.ts` + remove spec. Zero
migration, zero storage impact. BullMQ `queue.add` com `repeat.pattern`
re-upsert o scheduler no restart.

## Validação empírica (G4)

- Dia D+2 07:00 CET: rerun `node scripts/audit-image-coverage.mjs` Neon prod.
- Pass critério: LIDL ≥95% + Aldi ≥95%.
- Fail critério: < 95% → investigar adapter extraction rate específica
  (query dropouts counters LIDL S222 / Aldi parseDetail S219).
