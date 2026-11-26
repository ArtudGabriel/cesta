# ADR 0017 — Prod restoration playbook

- **Date:** 2026-11-26
- **Status:** Accepted (Sprint 188)
- **Related:** ADR 0013 (deploy resilience), ADR 0014 (blueprint sync), S187 memory `project-render-suspended-billing-2026-11`.

## Context

Em 2026-11-26 12:55Z `cesta-gsvc.onrender.com` começou a servir HTTP 503 "service suspended by its owner". Deploy S186 estava LIVE desde 12:36:39Z e serviu `/products` por ~19min antes da suspensão, confirmando que NÃO é regressão de código. Hipótese primária: Render free tier 750h/mês esgotou no fim de Novembro.

Loop paralisou prod-empírico (G5 de S187 e S188 ficaram marcados como "defer"). Code-only sprints seguem shippando (S187, S188), mas validação empírica da chain S179-S187 trava até prod voltar.

Boss tem 3 opções em aberto:

1. **Wait Dec 1 reset** — Render renova cota mensal. Zero custo. Risco: outras suspensões intermitentes se o volume de build/runtime bater o teto novamente.
2. **Render Starter plan $7/mês** — remove spin-down + cold start, raises build minute quota. Requer user approval (VETO ativo em stack $0 por default em `project-mvp-stack-zero-cost`).
3. **Fly.io migrate** — free tier 3 VMs shared-cpu-1x 256MB + 3GB persistent volume. Sem spin-down. Compat Node ✓, Prisma ✓, BullMQ via Upstash preservado. Trabalho: Dockerfile novo, migrate env, DNS swap. Risco: 3-5 dias Dev.

## Decision

Documentar playbook pra restoration (scripted, repetível) e defer a escolha Boss. Sprint 188 só entrega:
- Playbook de verificação pós-restore (`ops/smoke-test-prod.ts` executável headless).
- Observabilidade no retry logic do build (ADR 0013) via `scripts/report-migrate-attempt.mjs` — identifica se futuras suspensões ou P1002 retornam.
- Essa ADR com trade-offs documentados.

Escolha final fica com Boss; executor pós-escolha segue este playbook.

## Playbook pós-restoration

### Passo 0: confirmar servico de volta

```bash
curl -sSI https://cesta-gsvc.onrender.com/api/v1/health | head -n1
# Esperado: HTTP/2 200
```

Se 503 persiste, esperar + retomar sprint code-only. Não tocar em nada.

### Passo 1: smoke test completo

```bash
cd ops
npm install   # vitest + tsx se primeira vez
npm run smoke
# ou direto:
API_BASE=https://cesta-gsvc.onrender.com/api/v1 node --import tsx smoke-test-prod.ts
```

Exit code:
- `0` → regression chain S179-S187 verde. Prod pronto pra desbloquear próxima feature sprint.
- `1` → alguma section falhou (output indica qual). Tratar como REPROVA: criar sprint hotfix antes de empilhar features.
- `2` → fatal (API indisponível / parse quebrado). Investigar fetch antes de qualquer sprint.

Sections cobertas pelo smoke (ver `smoke-test-prod.lib.ts`):

| Section | Threshold | Origem |
|---|---|---|
| `health` | `/health` 200 + shape `status` | baseline |
| `products-total` | ≥8500 | S186 catalog MVP (baseline ~9500) |
| `supermarkets` | 6 supers ativos com total>0 | S186 (lidl 908 unblock) |
| `fuzzy-deterministic` | 3 queries × 3 runs, top1 ID idêntico + prefix OK | S185 tiebreak |
| `imageUrl-ratio` | ≥70% em sample 50 | S133 R2 blob pipeline |

### Passo 2: confirmar deploy em curso

Se restoration vem após suspensão por cota, Render pode exigir redeploy manual. Validar via API:

```bash
export RENDER_API_KEY="$(cat $USERPROFILE/.claude/secrets/render.env | cut -d= -f2)"
curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$CESTA_API_SERVICE_ID/deploys?limit=1" | jq '.[0].deploy.status'
# Esperado: "live"
```

### Passo 3: destravar vault

Mover entries de `projetos/cesta/pendente.md` que cobrem S187/S188 empíricos:
- Smoke run exit 0 → mark validated com timestamp.
- Smoke run exit 1 → criar sprint hotfix antes.

### Passo 4: rearmed loop

`maestri ask "Boss" "prod restored + smoke verde (SHA X, Y produtos); loop desblocado"` → Boss escolhe próxima sprint do backlog MVP (block 4 polish).

## Options comparison

| Option | $/mês | Lead time | Spin-down | Risco |
|---|---|---|---|---|
| (1) Wait Dec 1 | 0 | ~4 dias passivo | Mantém (free tier) | Outras suspensões se usage cresce |
| (2) Starter $7 | 7 | ~5min (plan upgrade) | Removido | VETO ativo stack $0 — needs user OK |
| (3) Fly.io migrate | 0 | 3-5 dias Dev | Removido | Dockerfile + DNS + retest full chain |

Recommendation (Dev perspective, não vinculante): aguardar Dec 1 reset primeiro, usar janela pra ship sprints code-only + observability. Se suspensão recorrer no novo ciclo, escalar pra opt (3). Opt (2) só se Boss remover VETO explícito.

## Consequences

- Prod-empírico fica bloqueado 4+ dias worst case. Sprints code-only (S187/S188) preservam velocidade.
- Smoke script passa a ser gate obrigatório em todo deploy a partir do próximo PR com empirical DoD.
- Observability nova (report-migrate-attempt) emite JSON estruturado em build log; se Sentry DSN presente, também breadcrumb+event. Zero impact quando DSN ausente.

## Follow-up

- Smoke script evolve com novas features: toda sprint com rota nova pública adiciona uma `check*` function no lib.
- Se opt (3) escolhida: nova ADR 0018 cobrindo Dockerfile + env parity.
