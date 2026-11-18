# ADR-0007 — Dashboard de métricas admin (`/admin/metrics`) (Sprint 107)

**Status:** Accepted · **Data:** 2026-11-18

## Contexto

Operamos Cesta sem visibilidade agregada do health do produto. Hoje, pra
responder "quantos users estão ativos?", "a pipeline de OCR está derrubando
notas?" ou "quantas cestas familiares foram geradas na semana?", a única
opção é abrir Neon SQL editor e rodar query ad-hoc. Nada substitui métrica
de operação pra decidir onde investir sprint.

Sprint 95 já shippou `/admin/users` (soft-deleted + grace period). Sprint 104
shippou `/admin/audit-logs`. A estrutura admin existe (AdminGuard + layout
protegido + i18n `admin.*`), falta o overview.

Requisitos definidos no kickoff S107:

1. 6 famílias de métricas agregadas (users, alertas, OCR, push, cesta familiar)
2. Gating admin (JwtAuthGuard + AdminGuard)
3. Rate limit mais apertado que default (consultas são caras)
4. Cache (agregações varrem tabelas grandes)
5. GDPR: zero PII no payload

## Decisão

Endpoint único `GET /admin/metrics` que retorna snapshot agregado com cache
in-memory 5min.

### Agregações

| Métrica | Query |
|---|---|
| `usersTotal` | `COUNT users WHERE deletedAt IS NULL` |
| `usersActive7d` | `COUNT DISTINCT user_id FROM refresh_tokens WHERE created_at >= now()-7d` |
| `alertsActiveByType.simple` | `COUNT alerts WHERE isActive AND deletedAt IS NULL` |
| `alertsActiveByType.{combo,trend,bundle}` | `COUNT alert_rules WHERE isActive AND deletedAt IS NULL GROUP BY type` |
| `receipts30d.parsed` | `COUNT receipts WHERE status='ready' AND createdAt >= now()-30d` |
| `receipts30d.failed` | `COUNT receipts WHERE status='failed' AND createdAt >= now()-30d` |
| `pushNotifications7d` | `COUNT(alerts WHERE lastNotifiedAt >= now()-7d) + COUNT(alert_rules WHERE lastNotifiedAt >= now()-7d)` |
| `familyBasketsGenerated7d` | `COUNT family_baskets WHERE status='ready' AND generatedAt >= now()-7d` |

### Cache

Map in-memory `{value: AdminMetricsSnapshot, expiresAt: number}` dentro do
service. TTL default 5min (`METRICS_CACHE_TTL_MS` env override). Flag `cached:
boolean` no payload pra observabilidade. Hit cacheado retorna o mesmo
`generatedAt` do fresh (não é "agora", é "quando a query rodou").

### Rate limit

`@Throttle({default:{limit:10,ttl:60_000}})` na rota. Default global é
120/60s; apertamos pra 10/60s porque cada miss do cache dispara 8 queries
agregadas (3 distinct/count + 1 groupBy + 2 counts + 2 counts).

## Alternativas descartadas

**A) Materialized view no Postgres + cron refresh 5min**
Rejeitada: adiciona objeto de schema (migration), scheduler extra (cron
refresh) e observabilidade cruzada (view stale != endpoint stale). Overkill
pra 1 dashboard interno. Reverter o commit basta pra rollback do atual.

**B) 6 endpoints separados (`/admin/metrics/users`, `/admin/metrics/alerts`, …)**
Rejeitada: quebra o cache compartilhado (cada endpoint com cache próprio =
6 relógios diferentes). Dashboard do frontend pede snapshot coerente (todas
as cards do mesmo instante). Um payload, um cache.

**C) Redis cache (compartilhado entre instâncias)**
Rejeitada por enquanto. Render free tier = 1 instância; cache in-memory
basta. Se escalar pra multi-worker (Pro plan), migra pra `CacheModule` +
Redis sem mudar contrato do endpoint.

**D) Sem cache (query a cada request)**
Rejeitada: 8 agregações varrendo tabelas grandes por request. Dashboard
admin tende a fazer poll manual (user refresh na aba). 5min TTL é mais
ampla do que humanly refresh rate.

## Consequências

Positivas:
- Snapshot coerente (todas métricas do mesmo instante).
- Cache in-memory é grátis (sem Redis, sem schema, sem cron).
- Payload leve (<300 bytes). Cacheável até em CDN edge se precisar.
- Zero PII: nenhum userId/email no payload. Dispensa `data-sentry-mask`.

Negativas:
- Cache não é shared entre workers (OK em single-instance Render; migrar
  pra Redis se escalar).
- `usersActive7d` é proxy via refresh_tokens — user que recebeu refresh
  mas nunca abriu o app conta como "ativo". Aceitável pra sinal grosseiro.
- Queries agregadas rodam sem índice dedicado. Em volume baixo (<100k users)
  são rápidas (<200ms). Monitorar `list_slow_queries` em Neon; adicionar
  índices se p95 > 1s.

## Rollback

Reverter o commit S107 remove endpoint, service, controller route, page
`/admin/metrics` e chaves i18n `admin.metrics.*`. Nenhuma migration de DB
envolvida — mudança 100% application layer.
