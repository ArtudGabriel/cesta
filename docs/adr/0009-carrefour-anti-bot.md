# ADR-0009 — Anti-bot Carrefour (ressurreição S134)

**Status:** Accepted (opção C) · **Data:** 2026-11-20
**Decisão user:** Opção C — Render Starter US$ 7/mo + Puppeteer reativo.

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

Dev recomendou **B (ScrapingBee)** por baixo compromisso financeiro.

### Escolha user (2026-11-20)

**Opção C — Render Starter US$ 7/mo + Puppeteer reativo.** Justificativa:
US$ 7 fixo bate US$ 29/mo (ScrapingBee Freelance) a longo prazo e
elimina dependência de vendor externo + API key management. Chromium
sempre custa ≈ 300 MB de pico → 2 GB RAM do Starter dá folga pros três
adapters Puppeteer (Carrefour, Alcampo) em serial.

## Consequências

- `PUPPETEER_SLUGS` e flag `CATALOG_SYNC_PUPPETEER_ENABLED` removidas
  do `catalog-sync.processor.ts`. Cron volta ao `SCHEDULE` único.
- Carrefour (`30 3 * * *`) e Alcampo (`0 4 * * *`) voltam ao
  agendamento diário Europe/Madrid.
- Eroski continua com bareFetch (S125) — não depende de Chromium.
- User upgrade Render dashboard:
  `dashboard.render.com/web/srv-dbst4muc6qcc73a3opr0 → Settings →
  Instance Type → Starter`. Pós-upgrade, trigger manual cron.

## Follow-ups

- Métrica S134: `prices WHERE supermarket.slug='carrefour' AND source='OFFICIAL'`
  deve pular de 1 → ≥ 100 pós-primeiro run.
- S135+ monitora: se Akamai bloquear Puppeteer de novo (headers/TLS
  fingerprint), fallback para B em branch `feat/carrefour-proxy`.
