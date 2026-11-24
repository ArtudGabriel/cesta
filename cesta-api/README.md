# cesta-api

Backend NestJS para o [Cesta](../README.md) — comparação de preços de supermercados (Comunidade de Madrid).

## Setup

```bash
npm install
npx prisma migrate dev
npm run start:dev          # http://localhost:3001
```

Variáveis de ambiente: ver [`../.env.example`](../.env.example).

## Scripts

| Script | Função |
|---|---|
| `npm run start:dev` | Hot-reload |
| `npm run build` | `nest build` → `dist/` |
| `npm run test` | Jest |
| `npm run test:coverage` | Jest + lcov |
| `npm run audit:dtos` | Verifica DTOs seguem padrão |
| `npm run audit:repos` | Verifica repositórios seguem padrão |
| `npm run sync:mercadona` | Sync manual Mercadona |
| `npm run sync:eroski` | Sync manual Eroski (ver seção abaixo) |
| `npm run sync:carrefour` | Sync manual Carrefour (Puppeteer local) |
| `npm run sync:alcampo` | Sync manual Alcampo (Puppeteer local) |
| `npx prisma studio` | DB inspector |

## Manual syncs (Sprints 137–138)

Alguns supermercados bloqueiam o IP datacenter do Render em páginas de
produto. O cron do `catalog-sync` roda esses adapters em prod mas a CDN
retorna 403/sem produtos para IPs non-residenciais. Opção escolhida:
rodar sync manual pelo laptop do dev (IP residencial) 1-2× por semana.

**Prereq comum pra Carrefour e Alcampo (adapters Puppeteer):**

```bash
cd cesta-api
# 1. instalar Chrome bundled (uma vez por máquina)
npm run install:chrome
# ↑ equivalente a `npx puppeteer browsers install chrome`.
#   Baixa pra ~/.cache/puppeteer/chrome/<platform>-<version>/ —
#   versão casada com a do puppeteer (DevTools protocol match).
```

**Por que bundled e não system Chrome?** Puppeteer `25.x` fala DevTools
protocol de Chrome 142; Chrome do sistema costuma estar em 155+ →
`ProtocolError: Protocol error ... Target.setAutoAttach` (S139 QA
REPROVA). Bundled sempre bate.

**Verificação após install:**

```bash
node -e "console.log(require('puppeteer').executablePath())"
```

Imprime um path tipo:
`C:\Users\<USER>\.cache\puppeteer\chrome\win64-142.0.7444.59\chrome-win64\chrome.exe`
(Windows) ou `~/.cache/puppeteer/chrome/mac-142.*/.../Chromium` (mac) ou
`~/.cache/puppeteer/chrome/linux-142.*/.../chrome` (Linux).

**Escape-hatch** `PUPPETEER_EXECUTABLE_PATH` ainda respeitado (útil se
bundled não baixa — firewall, offline, custom Chromium). Logger emite
WARN se setado junto com bundled disponível:

```powershell
# Windows PowerShell — só quando bundled falhar
$env:PUPPETEER_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

**Stealth plugin ativo** (`puppeteer-extra-plugin-stealth`): patcha
`navigator.webdriver`, plugins, WebGL vendor, lang etc. Sem stealth,
Akamai/WAF detectam headless e servem challenge sem `__NEXT_DATA__`
(S138 REPROVA: Carrefour 0/20, Alcampo 1/5). Com stealth + bundled Chrome,
expectativa Carrefour 20-50/run e Alcampo 10-30/run.

**Headful opcional** (abre janela visível; útil pra debug challenge):

```bash
export PUPPETEER_HEADFUL=true
npm run sync:carrefour -- --dry-run --max-queries=1
```

`CARREFOUR_ALCAMPO_CRON_ENABLED` fica `false` em prod — `scheduleCrons`
pula esses slugs e remove qualquer repeat scheduler stale. Para
ressuscitar em prod (só se Render virar paid tier com mais RAM),
setar a env `true` e redeploy.

### Eroski

A CDN deixa `/sitemap.xml` passar mas filtra `/es/supermercado/...`
quando o origem é datacenter. O Render atual retorna 0 produtos
silenciosamente (`items_processed=0` nos `sync_runs`).

**Pré-requisitos**

- `cesta-api/.env` com `DATABASE_URL` apontando pro Neon de prod.
- Conexão do laptop pela internet residencial (sem VPN datacenter).
- `npm install` executado com sucesso (Prisma client gerado).

**Checklist antes do primeiro run**

- [ ] `cat cesta-api/.env | grep DATABASE_URL` retorna a conexão Neon
  esperada.
- [ ] `npm run sync:eroski -- --dry-run --max-cats=3` imprime 100+
  produtos de amostra sem gravar nada.
- [ ] Verificar a amostra à mão (nome, preço, pacote) antes de rodar sem
  `--dry-run`.

**Comandos**

```bash
cd cesta-api

# inspeção sem escrita
npm run sync:eroski -- --dry-run --max-cats=3

# bootstrap curto (20 categorias, ~800 produtos)
npm run sync:eroski -- --max-cats=20

# cobertura mais larga (default 60 categorias)
npm run sync:eroski

# subset produtos (útil quando adapter vier com 2000+)
npm run sync:eroski -- --max-cats=20 --limit=200
```

**Flags**

| Flag | Default | Efeito |
|---|---|---|
| `--max-cats=N` | `60` | Trunca categorias fetchadas via `EROSKI_MAX_CATEGORIES` env |
| `--limit=N` | sem limite | Trunca produtos pós-fetch antes dos upserts |
| `--dry-run` | off | Zero writes DB — útil pra validar fetch |

**Frequência sugerida**

- 1× por semana cobre variação de preço esperada.
- Após reorganização grande do catálogo (migrations, seed novo), rodar
  manualmente.

**Idempotência**

Upsert por `normalizedName` (Eroski não expõe EAN público). Re-run do
mesmo comando atualiza `ProductPrice` existente, não duplica. Cada run
cria 1 linha nova em `PriceSnapshot` (histórico esperado).

**Diagnóstico**

- Script aborta com mensagem quando `DATABASE_URL` não está no `.env`.
- Adapter faz `throw` (não `return []`) quando **todas** as categorias
  falham — a mensagem aparece no stdout do script com os 3 últimos
  erros concatenados.
- Logs do próprio adapter saem via NestJS `Logger` (cor por level);
  usar `NEST_DEBUG=1` para ver o verbose.

### Carrefour

Akamai `_abck` challenge bloqueia qualquer `fetch` que não execute JS.
ScrapingBee tentou em S134 e também apanhou (status 500, cost 0 em
todos os tiers). Puppeteer local do laptop com Chrome instalado passa.

**Pré-requisitos**

- `.env` com `DATABASE_URL` → Neon prod.
- `npx puppeteer browsers install chrome` executado uma vez.
- Internet residencial (não VPN/datacenter).

**Comandos**

```bash
cd cesta-api

# inspeção sem escrita
npm run sync:carrefour -- --dry-run --max-queries=3

# bootstrap curto (10 queries, ~500 produtos)
npm run sync:carrefour -- --max-queries=10

# cobertura padrão (20 queries)
npm run sync:carrefour

# subset produtos (após fetch) pra iteração
npm run sync:carrefour -- --max-queries=5 --limit=50
```

**Flags**

| Flag | Default | Efeito |
|---|---|---|
| `--max-queries=N` | `20` | Queries seed (`CARREFOUR_MAX_QUERIES` env) |
| `--limit=N` | sem limite | Trunca produtos pós-fetch |
| `--dry-run` | off | Zero writes DB |

**Cadência:** 1× por semana.
**Tempo de run:** `--max-queries=10` leva ~3-5min dependendo do
challenge Akamai + hydration SPA. Chrome fecha ao final (`closePuppeteerBrowser`).

### Alcampo

AWS WAF `jsapi.js` challenge bloqueia `fetch`. Sitemap passa via
`politeFetchRaw` (bare headers); páginas de produto precisam Puppeteer.

**Pré-requisitos** idem Carrefour (Chrome instalado via Puppeteer).

**Comandos**

```bash
cd cesta-api

# inspeção
npm run sync:alcampo -- --dry-run --max-products=5

# bootstrap curto (30 pages, com delay 2s)
npm run sync:alcampo -- --max-products=30

# cobertura padrão (120 pages)
npm run sync:alcampo
```

**Flags**

| Flag | Default | Efeito |
|---|---|---|
| `--max-products=N` | `120` | Páginas de produto fetched (`ALCAMPO_MAX_PRODUCTS` env) |
| `--limit=N` | sem limite | Trunca produtos pós-fetch |
| `--dry-run` | off | Zero writes DB |

**Cadência:** 1× por semana.
**Tempo de run:** `--max-products=30` leva ~1-2min (2s/page + navegação).
Sem EAN nas páginas; match por `normalizedName`.

## JWT secret rotation (Sprint 92)

Assinatura usa sempre `JWT_*_SECRET_CURRENT`. A verificação tenta `_CURRENT` e
cai pro `_PREVIOUS` quando configurado — janela de overlap zero-downtime.

Procedimento (acesso ou refresh; aplica-se igual aos dois):

1. Copie `JWT_ACCESS_SECRET_CURRENT` para `JWT_ACCESS_SECRET_PREVIOUS` (idem
   refresh). No Render: painel do serviço → Environment → edit.
2. Gere novo valor em `JWT_ACCESS_SECRET_CURRENT` (ex: `openssl rand -hex 48`).
3. Deploy. Boot escreve `[audit] SecretRotated kinds=...` no log confirmando
   que `_PREVIOUS` está carregado.
4. Aguarde o TTL do refresh token (`JWT_REFRESH_EXPIRES_IN`, default `7d`).
   Access tokens de 15m e refresh tokens antigos continuam válidos nesse
   intervalo.
5. Após a janela, remova `JWT_ACCESS_SECRET_PREVIOUS` / `JWT_REFRESH_SECRET_PREVIOUS`
   e redeploy. Rotação completa.

Não gire `access` + `refresh` no mesmo deploy; escalone pelo menos um ciclo de
refresh entre eles pra evitar invalidar todas as sessões ativas.

## Puppeteer disabled em free tier (Sprint 130)

Adapters `carrefour`, `alcampo` e `eroski` dependem de Puppeteer headless Chromium
(bypass Akamai/AWS WAF/reCAPTCHA). Em Render free tier (512MB RAM) Chromium
~300MB + Node ~150MB estoura o limite e dispara `oomKilled` (evento
confirmado 2026-11-19 22:49:24Z).

**Default produção**: 4 adapters leves ativos (Mercadona, DIA, LIDL, Aldi).
Bootstrap boot enfileira apenas estes 4; cron scheduler pula os Puppeteer.
Adapters permanecem registrados em DI — podem ser invocados manualmente via
`POST /admin/catalog-sync/<slug>/run` se necessário (uma única run cabe em
RAM, risco é cron+bootstrap simultâneo).

**Reabilitar após upgrade para Render Pro (1GB+)**:

```
AUTO_SYNC_ON_BOOT_SLUGS=mercadona,dia,lidl,aldi,carrefour,alcampo,eroski
CATALOG_SYNC_PUPPETEER_ENABLED=true
```

Ou migrar `catalog-sync` worker para serviço separado (bull-worker container
com RAM dedicada) — padrão recomendado quando tráfego real justificar.

## Documentação

- [`../README.md`](../README.md) — overview, deploy, CI
- [`../CLAUDE.md`](../CLAUDE.md) — contexto do projeto
- [`../SECURITY.md`](../SECURITY.md) — reporting, SLA, GDPR
- [`../claude-geral-consolidado.md`](../claude-geral-consolidado.md) — padrões de dev
