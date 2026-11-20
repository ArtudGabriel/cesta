# ADR-0009 — Anti-bot Carrefour (ressurreição S134)

**Status:** Proposed · **Data:** 2026-11-20

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

### Recomendação Dev

**Opção B (ScrapingBee free tier)** — primeiro teste. Baixo compromisso
financeiro, API key resolve bootstrap. Se validar que Carrefour +
Alcampo + Eroski produzem ≥ 100 produtos cada em 500 créditos, parte-se
para plano pago US$ 29/mo (Freelance) ou troca-se por C.

**Opção C** fica como contingência se B falhar.

## Consequências

- **Sprint 134 PAUSADA** até user escolher B ou C.
- Carrefour continua desativada (prod sample ≤ 2 produtos).
- MVP Bloco 1 fica em 2/3 supermercados reais (Mercadona + DIA + Aldi).
  Alcampo e Eroski compartilham o mesmo bloqueio Akamai → decisão
  aqui também vale para eles.

## Follow-ups (dependem da escolha)

- **Se B:** adapter re-escrito com `undici.ProxyAgent(SCRAPINGBEE_URL)`
  + spec com fixture JSON real-shape. Sem Puppeteer. Remove
  `PUPPETEER_SLUGS.has('carrefour')` em `catalog-sync.processor.ts`.
- **Se C:** remove `CATALOG_SYNC_PUPPETEER_ENABLED` do filtro + user
  faz upgrade Render. Nenhuma mudança de código além do processor.
