# ADR 0035 — Proposta migração cross-region (Render Frankfurt + Neon EU)

- **Data:** 2026-11-27
- **Sprint:** S227 (user feedback perf #1/#2)
- **Status:** **Proposto** (NÃO executar sem aprovação explícita user)
- **Decide:** Gabriel (Boss leva proposta)
- **Relaciona:** ADR 0025 (bandwidth budget Render), MVP stack ~$6-8/mês

## Contexto

### Stack atual multi-região

| Camada    | Serviço | Região           | Provider |
|-----------|---------|------------------|----------|
| Frontend  | Vercel  | `cdg1` Paris     | AWS      |
| Backend   | Render  | Oregon (us-west) | AWS      |
| Database  | Neon    | Ohio us-east-2   | AWS      |
| Cache/queue | Upstash | EU (Dublin/Ireland) | AWS |
| Object storage | Cloudflare R2 | EU | Cloudflare |

### Diagnóstico latência

User feedback S227 #1/#2 reporta lentidão perceptível em home e navegação. Trace de origem (usuário em Madrid):

```
Madrid user
   │  ~10 ms  (Vodafone/Movistar → Paris cdg1)
   ▼
Vercel cdg1 (Paris)
   │  ~150 ms (Atlantic: Paris → Oregon)
   ▼
Render API (Oregon)
   │  ~60 ms  (continental: Oregon → Ohio)
   ▼
Neon Postgres (Ohio us-east-2)
```

**Round-trip teórico por request API:**

- 1 handshake TCP/TLS Vercel↔Render: ~150 ms (3-way + TLS resumption)
- N queries DB (sequenciais): N × 60 ms
- Response Render → Vercel: ~150 ms
- Vercel → user: ~10 ms

Para carga home típica (~5 queries sequenciais: supermarkets, categories, products page 1, featured deals, user profile se logado):

```
10 + 150 + (5 × 60) + 150 + 10 ≈ 620 ms
```

Para navegação simples (1-2 queries): `~400 ms`. Comparar com percepção ideal mobile `<200 ms`.

### Proposta

Migrar backend + DB para região europeia alinhada com Vercel `cdg1`:

- **Render** → Frankfurt, Germany (`frankfurt`) — mesma AWS `eu-central-1`.
- **Neon** → `aws-eu-central-1` (Frankfurt) — mesmo AWS Frankfurt que Render.

### Latência estimada pós-migração

```
Madrid user
   │  ~10 ms  (Vodafone/Movistar → Paris cdg1)
   ▼
Vercel cdg1 (Paris)
   │  ~15 ms  (intra-EU: Paris → Frankfurt)
   ▼
Render API (Frankfurt)
   │  ~3-5 ms (same-region: Frankfurt → Frankfurt Neon)
   ▼
Neon Postgres (Frankfurt)
```

Round-trip home típica pós-migração:

```
10 + 15 + (5 × 5) + 15 + 10 ≈ 75 ms
```

**Delta esperado:** ~620 ms → ~75 ms para 5 queries = redução ~8×. Para 1 query (navegação): ~400 ms → ~55 ms = redução ~7×. Alinha com user perception `<200 ms`.

Baseline empírico atual deve ser medido em prod (Lighthouse mobile TTFB/LCP home + `/comparar` + `/produto/[pid]`) antes/depois pra validar o teórico — hoje ainda não registrado em nota Status. A medição é bloqueio pré-execução, não pré-decisão.

## Decisão

**Não decidido.** Este ADR documenta a proposta e os trade-offs; execução depende de aprovação explícita do user (Boss leva).

Se aprovada, plano de migração sugerido abaixo.

## Trade-offs

### Custos (preços oficiais sites 2026-11-27)

| Peça | Hoje | Proposta | Delta |
|------|------|----------|-------|
| Vercel cdg1 (Paris) | Hobby $0 | Hobby $0 | $0 |
| Render Starter (Oregon) | $7/mês + $0.15/GB overage (ADR 0025) | $7/mês Frankfurt + $0.15/GB overage | $0 (parity tier-based, sem diferencial regional confirmado em `render.com/pricing`) |
| Neon Launch (Ohio) | $5/mês + CU-hours $0.106 | $5/mês Frankfurt + CU-hours $0.106 | $0 (Neon pricing não diferencia por região no Launch plan) |
| Upstash PAYG (Dublin) | ~$1-3/mês | ~$1-3/mês (sem mover) | $0 |
| R2 (EU) | $0 free tier | $0 free tier (sem mover) | $0 |

**Total delta financeiro esperado: ~$0/mês** (sujeito a mudanças silenciosas de preço — confirmar nos dashboards antes da execução, não neste doc).

Caveats:
- `render.com/pricing` tier pages estão incompletas em alguns snapshots indexados; terceiros não confirmam diferencial regional, mas Render community confirma Frankfurt mapeia pra AWS eu-central-1 (custo wholesale AWS Frankfurt ligeiramente maior que Oregon — Render pode repassar no futuro).
- Neon usage-based CU-hours: carga idle mínima deve ser similar. Egress intra-região (Render ↔ Neon Frankfurt) = **grátis**, vs hoje Render Oregon → Neon Ohio que já atravessa AWS cross-region egress (hoje: presumivelmente coberto pelo Neon Launch plan — validar no billing dashboard).

### Downtime estimado

Cenário de migração blue/green (mínimo downtime):

| Fase | Ação | Duração | Tráfego afetado |
|------|------|---------|-----------------|
| 1 | Provisão: criar Render service Frankfurt + Neon project EU em paralelo (sem tráfego) | ~30 min | Nenhum |
| 2 | Deploy mesmo commit no novo Render Frankfurt; smoke-test health endpoints | ~15 min | Nenhum |
| 3 | Dump Postgres atual (`pg_dump` Neon Ohio) + restore no Neon Frankfurt | ~5-10 min (DB ~50MB atual) | Nenhum |
| 4 | **Janela de write-freeze**: pausar catalog-sync crons + flush BullMQ Upstash | ~5 min | Jobs backlog curto |
| 5 | Dump incremental + apply em Neon Frankfurt (delta da janela) | ~2 min | Nenhum |
| 6 | Trocar `DATABASE_URL` env var no Render Frankfurt + redeploy | ~3 min cold-start | Nenhum |
| 7 | **DNS cutover**: Vercel `NEXT_PUBLIC_API_URL` para Render Frankfurt URL (ou CNAME) | TTL 60s + propagação ~1-2 min | **1-3 min API indisponível** |
| 8 | Smoke-test prod + Lighthouse comparativo | ~15 min | Nenhum |
| 9 | Keep-alive Render Oregon + Neon Ohio por 48h (rollback window) | 48h | Nenhum (apenas custo duplicado) |

**Downtime real:** `~1-3 min` (passo 7, DNS cutover + health). Catalog-sync write-freeze janela: `~10 min`. Reads continuam pelo Render Oregon até cutover.

Pior caso (restore demora, erros de env, rollback necessário): 30-60 min. Usuário percebe como "app lento/indisponível 1-3 min" no momento do switch.

### Risco

**Alto risco:**
- `DATABASE_URL` connection string change: todo env var consumer (migrations, workers, API) precisa receber a nova URL. Prisma `migrate deploy` reaplicado só pra confirmar schema — nenhuma migração nova.
- Latency cross-region residual se qualquer serviço (ex: catalog-sync worker, Upstash queue) não mover: hoje Upstash está em Dublin (`eu-west-1`) → `~20 ms` Frankfurt↔Dublin, aceitável, mas inverte hoje que Upstash está "longe" do Render (Dublin → Oregon ~140 ms).
- Sentry DSN + outros SaaS: região do endpoint do Sentry é EU (`ingest.de.sentry.io`) — hoje já paga Atlantic do Render Oregon. Pós-migração, ganha ~150 ms nesse path.

**Médio risco:**
- Neon aws-eu-central-1 pode ter janela de manutenção diferente de us-east-2. Checar status.neon.tech histórico.
- GDPR melhora: DB em AWS Frankfurt elimina data transfer EUA→EU e volta a estar sob SCCs internos UE-UE, não Schrems II. Positivo pra privacy footer.

**Baixo risco:**
- Render não permite mudar região do service in-place (confirmado: "Render doesn't currently support changing the region for an existing service or database"). Necessário criar service novo → outra URL `.onrender.com` → outro `srv-` id. Procedure padrão.
- Backup atual (Neon branching) permanece no projeto Ohio durante janela de 48h — rollback é `DATABASE_URL` swap + DNS flip back.

### Rollback

Rollback window `48h`:

1. Reverter Vercel env `NEXT_PUBLIC_API_URL` para Render Oregon URL.
2. Render Oregon continua rodando (não suspender até validação). Último commit deploy preservado.
3. Neon Ohio continua rodando read-write (não deletar).
4. Writes feitos no Neon Frankfurt durante o rollback window seriam perdidos — mitigação: habilitar logical replication Frankfurt → Ohio durante os 48h, ou aceitar perda de writes de ~1-2 dias de catalog-sync (crons noturnos podem re-rodar).

Pós-48h validados, decommissão Render Oregon + Neon Ohio.

### Alternativas descartadas

1. **Mover só Neon pra EU, manter Render Oregon.** Pior dos mundos: Render Oregon → Neon Frankfurt = ~150 ms Atlantic por query × N queries. Piora significativa vs hoje. **Descartada.**
2. **Mover só Render, manter Neon Ohio.** Melhora Vercel↔Render (~150 ms → ~15 ms) mas piora Render↔DB (~60 ms → ~100 ms Frankfurt → Ohio Atlantic). Net improvement só se queries < 2; home tem 5. **Descartada.**
3. **Manter stack US e mover Vercel pra iad1.** Pior pra usuários em Madrid (frontend fica longe). **Descartada.**
4. **Trocar Render por alternativa EU-nativa (Koyeb, Fly.io, sota.io).** Fora do escopo (muda vendor + custo risco). Reavaliar só se Render Frankfurt não resolver.

## Consequências

**Se executado:**
- Latência home 620 ms → ~75 ms (teórico, validar empírico).
- GDPR data-at-rest melhora (DB em UE elimina transferência EUA cliente↔DB).
- Keep-alive window 48h duplica custo Render + Neon ≈ `~$12-15` one-off.
- Documentação CLAUDE.md + MEMORY.md precisa atualizar `project-mvp-stack-zero-cost.md` e referências de região.
- Novo `srv-` id Render + nova Neon project id — todos secrets (`.claude/secrets/render.env`, `.claude/secrets/neon.env` se existir) e CI workflows precisam atualização.

**Se não executado:**
- User feedback #1/#2 permanece: lentidão perceptível em cold load + navegação.
- Alternativas code-only (S227 #1/#2 PR #202 já merged) mitigam parcialmente: nav instant, SSR cache categories, prefetch rotas — mas não resolvem latência de queries dinâmicas (`/products` com filtros, `/suggest`, etc.).

## Sources

- [Render Pricing](https://render.com/pricing.md) — Starter plan tier, outbound bandwidth $0.15/GB
- [Render Regions](https://render.com/docs/regions) — Frankfurt availability, AWS eu-central-1 mapping
- [Render community: region mapping](https://community.render.com/t/which-render-regions-map-to-which-cloud-providers/5987) — region cannot be changed after service creation
- [Render Workspace Plans 2026](https://render.com/changelog/updated-plans-for-render-workspaces) — plan changes April + August 2026
- [Neon Pricing](https://neon.com/pricing) — Launch $5/mês + CU-hours
- [Neon Usage-based Pricing](https://neon.com/blog/new-usage-based-pricing) — $0.106/CU-hour Launch
- [Neon Changelog AWS Frankfurt](https://neon.com/docs/changelog/2025-08-15) — region `aws-eu-central-1` availability
- [Vercel fra1 Regional Pricing](https://vercel.com/docs/pricing/regional-pricing/fra1) — reference pra região Frankfurt
