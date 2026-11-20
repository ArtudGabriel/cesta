# ADR-0009 — Anti-bot Carrefour (ressurreição S134)

**Status:** Accepted (opção A ScrapingBee) · **Data:** 2026-11-20
**Decisão user:** Opção A — ScrapingBee proxy residencial (free tier bootstrap).
Opção C (Render Starter + Puppeteer) rejeitada em segunda revisão — user
observou que o Starter continua em 512 MB (upgrade só vai de free sleep
para Starter sem sleep; RAM igual), portanto mesma OOM.

## Contexto

Em produção (sample 100 produtos, 2026-11-20):

| Supermercado | Prices |
|---|---|
| Mercadona | 58 |
| DIA | 40 |
| Alcampo, Eroski, Carrefour, Froiz, LIDL, Aldi | ≤ 2 |

MVP Bloco 1 exige ≥ 2000 produtos de ≥ 3 supermercados. Carrefour é o
segundo supermercado nominal do escopo MVP (Bloco 1), mas S128 (Puppeteer
bypass) foi desativada em S130 por OOM no Render free tier (512 MB —
Chromium ~200 MB + Node ~150 MB + Prisma + BullMQ workers).

Hoje `CarrefourAdapter.fetchProducts()` depende de `puppeteerFetch` e
está desligada do cron (`PUPPETEER_SLUGS` em `catalog-sync.processor.ts`).

## Experimentos sem Puppeteer (2026-11-20)

Probing direto `fetch()` contra `www.carrefour.es` da máquina Dev:

| Alvo | Status |
|---|---|
| `www.carrefour.es/robots.txt` | 200 ✅ |
| `www.carrefour.es/api/v1/search?query=leche` | 403 (Akamai) |
| `www.carrefour.es/search/api?q=leche` | 503 |
| `www.carrefour.es/api/search?q=leche` | 503 |
| `www.carrefour.es/api/graphql` | 503 |
| `www.carrefour.es/crs/cdn-static/sitemap-food/index.xml` | 403 |
| `www.carrefour.es/_includes/sitemap.xml` | 403 |
| `www.carrefour.es/tecno/dyn/MEDIA/siteindex.xml` | 403 |
| `api.carrefour.es` | DNS NXDOMAIN |
| `services.carrefour.es` | DNS NXDOMAIN |
| `mobile.carrefour.es` | DNS NXDOMAIN |
| UA Googlebot sobre sitemap | 403 |
| UA mobile app `Carrefour/8.12.0 (Android 13; Pixel 6)` | 502 |
| UA `okhttp/4.9.0` | 502 |
| UA `Dalvik/2.1.0 …` | 502 |

Akamai `_abck` challenge bloqueia qualquer cliente que não execute JS
(todos os endpoints HTML e XML, mesmo CDN-static). Sem browser engine
ou token Akamai válido, não há path aberto por fetch raw.

## Decisão

**Bloqueado — requer aprovação do user** entre duas opções pagas.
Dev não implementa nenhuma até escolher.

### Opção A — Mobile API discovery (descartada agora)

**O que:** Capturar tráfego do app Carrefour Android via mitmproxy +
APK extraído do APKMirror, identificar endpoint real + token signing.

**Custo:** 0 €.
**Risco:** 3-5 dias de reverse engineering, chance alta de o app assinar
requests com cert pinning + HMAC rotativo. Mesmo se funcionar, Akamai
pode bloquear datacenter IP mesmo com token válido → Render fica fora.
**Fallback:** nenhum — é tudo ou nada.

**Por que descartada:** fora do budget de uma sprint. Volta como
backlog se A e B falharem.

### Opção B — Proxy residencial free tier

**Candidatos:**
- ScrapingBee — 1000 free credits (≈ 1000 páginas/mês com JS off,
  ≈ 100 com JS on). Pricing pago US$ 49/mo pra 150 000 credits.
- Bright Data — 7-day trial, pay-per-use; US$ 500 mínimo pra plano
  Web Unlocker (não free a longo prazo).
- Zyte (ex Scrapinghub) — Zyte API, US$ 25/mo entry.

**Como:** HTTP CONNECT via proxy residencial + rotação de IP → Akamai
trata como user real. Adapter faz `fetch(url, { agent: proxyAgent })`
com API key no header.

**Custo:** free tier cobre bootstrap (≈ 500 produtos iniciais em
~5 queries × 20 pages). Depois, US$ 25-49/mês para manter cron diário.

**Risco:** free tier estoura rápido se cron rodar diário (20 queries
seed × 1 page × 30 dias = 600 req/mês já = 60 % do ScrapingBee free).
API key precisa ser gerada pelo user (Dev não pode sign-up na conta
pessoal dele). Vendor pode bloquear datacenter como abuse.

**Fallback:** troca vendor se um bloquear.

**Dependência user:** cadastrar em ScrapingBee → copiar API key →
adicionar env var `SCRAPINGBEE_API_KEY` em Render.

### Opção C — Render Starter paid US$ 7/mês + re-ativar Puppeteer

**Como:** upgrade do serviço `cesta-api` free → Starter (512 MB → 2 GB
RAM, no spin-down). Remove flag `CATALOG_SYNC_PUPPETEER_ENABLED=true` do
env. Puppeteer slugs (carrefour, alcampo, eroski) voltam ao cron.

**Custo:** US$ 7/mês fixo (US$ 84/ano). Primeiro tier sem spin-down.
**Risco:** Chromium sempre custa ≈ 300 MB de pico — 2 GB folgado para
Carrefour + Alcampo + Eroski em serial. **Mesmo Akamai pode bloquear
Puppeteer** depois (S128 funcionou, mas CDN atualiza impressões).
**Fallback:** combinar com B se Puppeteer ficar bloqueado novamente.

**Dependência user:** aprovar billing + fazer upgrade no dashboard
Render.

### Recomendação Dev (histórica)

Dev recomendou **B** inicialmente (menor compromisso financeiro), user
escolheu **C**, depois revisou para **A** (ScrapingBee) ao perceber que
o Render Starter tem o mesmo 512 MB do free tier (só muda o sleep).

### Escolha user (2026-11-20, revisada)

**Opção A — ScrapingBee proxy residencial.** `SCRAPINGBEE_API_KEY` já
foi provisionado no Render (Manager via Render API). Estratégia inicial:
`render_js=true` sem `premium_proxy` (5 credits/call = ≈ 200 queries/mês
no free tier de 1000 credits). Escalar para premium (25 credits = 40
queries/mês) apenas se Akamai bloquear a rota básica.

## Consequências

- **Adapter rewrite (não mais Puppeteer):** `carrefour.adapter.ts` e
  `alcampo.adapter.ts` chamam `scrapingbeeFetch()` em vez de
  `puppeteerFetch()`. Util `scrapingbee-fetch.ts` novo em
  `catalog-sync/utils/`.
- **Puppeteer removido:** `puppeteer-fetch.ts` + spec deletados;
  dependências `puppeteer-core` e `@sparticuz/chromium-min`
  desinstaladas (zero consumers pós-refactor). Sem Chromium → RAM
  baixa de ≈ 200 MB de pico. Free tier Render volta a caber.
- **Processor inalterado** após S134: `SCHEDULE` único, sem gate.
  Mercadona, Carrefour, Alcampo, DIA, Eroski diários; Froiz/LIDL/Aldi
  semanais (terça).
- **Credits budget:** 20 queries Carrefour + ~100 produtos Alcampo
  = ≈ 600 credits/dia. Insuficiente no free tier diário → limitar a
  1 run/dia, ou upgrade pago `Freelance` US$ 29/mo pra 150 k credits.
  Follow-up S135 monitora.

## Follow-ups

- Métrica S134: `prices WHERE supermarket.slug IN ('carrefour','alcampo')
  AND source='OFFICIAL'` ≥ 100 cada pós-primeiro run.
- S135 verifica consumo real de credits via header `Spb-Cost`
  (logado em `scrapingbeeFetch`). Decide upgrade pago vs limitar queries.
- Se Akamai bloquear `render_js` básico: ativar `premiumProxy: true`
  no `CarrefourAdapter` (5× custo, mas residencial IP).
