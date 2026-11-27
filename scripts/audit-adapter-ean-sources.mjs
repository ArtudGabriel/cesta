#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint 229 G1b (ADR 0038) — audit live das fontes EAN por adapter.
 *
 * Probe READ-ONLY dos endpoints públicos de cada adapter, extrai a shape
 * do payload e reporta se há campo EAN/GTIN exposto. Alinha o esforço
 * com o Boss: onde a fonte expõe, S229 adapter ganha extração (padrão
 * Aldi S228 G1). Onde não expõe, o gap vai pra G3 (pg_trgm).
 *
 * NÃO é cron. Rodar manualmente quando reauditar:
 *   node scripts/audit-adapter-ean-sources.mjs
 *
 * Boss guard: zero escrita, zero impacto em prod, zero credencial.
 */
import process from 'node:process';

const RESULTS = [];

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; Cesta-audit/1.0; https://usecesta.es)',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'es-ES,es;q=0.9',
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; Cesta-audit/1.0; https://usecesta.es)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
      'Accept-Language': 'es-ES,es;q=0.9',
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function findEanLike(obj, path = '') {
  if (!obj || typeof obj !== 'object') return [];
  const hits = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k;
    const lk = k.toLowerCase();
    if (/(^|_)(ean|gtin|barcode|upc)([_$]|$)/i.test(k)) {
      hits.push({ path: p, value: typeof v === 'object' ? '(object)' : v });
    }
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      hits.push(...findEanLike(v, p));
    }
  }
  return hits;
}

function sampleFields(obj, depth = 2, path = '') {
  if (depth < 0 || !obj || typeof obj !== 'object') return [];
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k;
    if (v === null || typeof v !== 'object') {
      out.push(`${p}: ${JSON.stringify(v).slice(0, 60)}`);
    } else if (Array.isArray(v)) {
      out.push(`${p}: [${v.length}]`);
    } else {
      out.push(`${p}: {...}`);
      out.push(...sampleFields(v, depth - 1, p));
    }
  }
  return out;
}

async function probeMercadona() {
  try {
    const cats = await fetchJson(
      'https://tienda.mercadona.es/api/v1_1/categories/?lang=es&wh=mad1',
    );
    const roots = cats?.results ?? [];
    let withEan = 0;
    let withoutEan = 0;
    let listSample = null;
    let listSampleId = null;
    outer: for (const root of roots.slice(0, 8)) {
      for (const sub of (root.categories ?? []).slice(0, 4)) {
        try {
          const cat = await fetchJson(
            `https://tienda.mercadona.es/api/categories/${sub.id}/?lang=es&wh=mad1`,
          );
          const products = [
            ...(cat?.products ?? []),
            ...(cat?.categories ?? []).flatMap((c) => c?.products ?? []),
          ];
          for (const p of products) {
            if (!listSampleId) listSampleId = p.id;
            if (p.ean) {
              withEan += 1;
              if (!listSample) listSample = p;
            } else {
              withoutEan += 1;
            }
          }
          if (withEan >= 3) break outer;
        } catch {
          // continua
        }
      }
    }
    // Probe secundário: endpoint de detalhe GET /products/<id>/ — às vezes
    // EAN só aparece nesse shape (mais verboso).
    let detailSample = null;
    let detailHasEan = false;
    if (listSampleId) {
      try {
        const detail = await fetchJson(
          `https://tienda.mercadona.es/api/products/${listSampleId}/?lang=es&wh=mad1`,
        );
        detailSample = detail;
        detailHasEan = Boolean(detail?.ean);
      } catch {
        // ignora
      }
    }
    const listHits = listSample ? findEanLike(listSample) : [];
    const detailHits = detailSample ? findEanLike(detailSample) : [];
    RESULTS.push({
      adapter: 'mercadona',
      endpoint_list: 'GET /api/categories/<id>/',
      endpoint_detail: 'GET /api/products/<id>/',
      sampled_products_with_ean_list: withEan,
      sampled_products_without_ean_list: withoutEan,
      list_ean_fields: listHits,
      detail_probe_product_id: listSampleId,
      detail_has_ean: detailHasEan,
      detail_ean_fields: detailHits,
      extracts_today: 'yes (raw.ean em list) · service não fetcha detail',
      decision:
        withEan > 0
          ? 'KEEP: raw.ean na listagem funciona'
          : detailHasEan
            ? 'ADD: probe detail retorna ean — adicionar fetch opt-in no adapter'
            : 'INVESTIGATE: nem list nem detail expõem ean em probes (categoria/produto específico?)',
    });
  } catch (e) {
    RESULTS.push({ adapter: 'mercadona', error: String(e) });
  }
}

async function probeDia() {
  try {
    const data = await fetchJson(
      'https://www.dia.es/api/v1/search-back/search?q=leche&page=1',
    );
    const firstProduct = data?.search_items?.[0];
    if (!firstProduct) throw new Error('search_items vazio');
    const hits = findEanLike(firstProduct);
    RESULTS.push({
      adapter: 'dia',
      endpoint: 'GET /api/v1/search-back/search?q=<q>',
      sample_product_id: firstProduct.object_id ?? firstProduct.sku_id,
      ean_fields: hits,
      extracts_today: 'no (ean: null)',
      decision: hits.length
        ? 'ADD: source agora expõe ean'
        : 'GAP: sem EAN público → G3 trigram',
      fields_present: sampleFields(firstProduct, 1).slice(0, 20),
    });
  } catch (e) {
    RESULTS.push({ adapter: 'dia', error: String(e) });
  }
}

async function probeLidl() {
  try {
    const html = await fetchText('https://www.lidl.es/q/search?q=leche');
    // LIDL encapsula JSON HTML-encoded. Varre pra campos EAN-like.
    const decoded = html.replace(/&quot;/g, '"');
    const match = decoded.match(/\[\{"erpNumber"[\s\S]*?\}\]/);
    if (!match) throw new Error('sem JSON embed');
    try {
      const arr = JSON.parse(match[0]);
      const first = arr[0];
      const hits = findEanLike(first);
      RESULTS.push({
        adapter: 'lidl',
        endpoint: 'GET /q/search?q=<q> (HTML-encoded JSON embed)',
        sample_product_id: first?.erpNumber,
        ean_fields: hits,
        extracts_today: 'no (ean: null)',
        decision: hits.length
          ? 'ADD: campo exposto'
          : 'GAP: sem EAN público → G3 trigram',
        fields_present: sampleFields(first, 1).slice(0, 20),
      });
    } catch (parseErr) {
      RESULTS.push({
        adapter: 'lidl',
        endpoint: 'GET /q/search',
        error: `JSON parse falhou: ${parseErr.message}`,
        html_bytes: html.length,
      });
    }
  } catch (e) {
    RESULTS.push({ adapter: 'lidl', error: String(e) });
  }
}

async function probeEroski() {
  try {
    // Fetch sitemap → pega 1 categoria folha → extrai primeiro data-metrics.
    const sitemap = await fetchText(
      'https://supermercado.eroski.es/sitemap.xml',
    );
    const match = sitemap.match(
      /<loc>(https:\/\/supermercado\.eroski\.es\/es\/supermercado\/[^<]+\/)<\/loc>/,
    );
    if (!match) throw new Error('sitemap sem categoria folha');
    const catHtml = await fetchText(match[1]);
    const dataMetric = catHtml.match(/data-metrics="([^"]+)"/);
    if (!dataMetric) throw new Error('sem data-metrics');
    const parsed = JSON.parse(dataMetric[1].replace(/&quot;/g, '"'));
    const first = parsed?.ecommerce?.items?.[0];
    if (!first) throw new Error('ecommerce.items vazio');
    const hits = findEanLike(first);
    RESULTS.push({
      adapter: 'eroski',
      endpoint: 'HTML <a data-metrics> ecommerce JSON',
      sample_product_id: first.item_id,
      ean_fields: hits,
      extracts_today: 'no (ean: null)',
      decision: hits.length
        ? 'ADD: campo exposto'
        : 'GAP: sem EAN público → G3 trigram',
      fields_present: sampleFields(first, 1).slice(0, 20),
    });
  } catch (e) {
    RESULTS.push({ adapter: 'eroski', error: String(e) });
  }
}

async function probeFroiz() {
  try {
    // Froiz é bare HTML scrape sem structured data.
    const html = await fetchText(
      'https://supermercado.froiz.com/alimentacion/galletas',
    );
    const hasJsonLd = /<script[^>]*type=["']application\/ld\+json["']/i.test(html);
    const hasEanAttr = /ean[-_]?\d{8,14}/i.test(html);
    RESULTS.push({
      adapter: 'froiz',
      endpoint: 'bare HTML scrape (product-grid .product cards)',
      has_jsonld: hasJsonLd,
      has_ean_like_attr: hasEanAttr,
      extracts_today: 'no (ean: null)',
      decision:
        hasJsonLd || hasEanAttr
          ? 'INVESTIGATE: possível EAN em JSON-LD/attr'
          : 'GAP: sem EAN público → G3 trigram',
    });
  } catch (e) {
    RESULTS.push({ adapter: 'froiz', error: String(e) });
  }
}

async function main() {
  console.log('[S229 G1b] live probe · read-only · ~30s por adapter');
  console.log('='.repeat(72));
  await probeMercadona();
  await probeDia();
  await probeLidl();
  await probeEroski();
  await probeFroiz();
  console.log('\n--- Audit result (JSON) ---');
  console.log(JSON.stringify(RESULTS, null, 2));
  console.log('\n--- Summary ---');
  for (const r of RESULTS) {
    const decision = r.decision ?? (r.error ? `ERROR: ${r.error}` : 'n/a');
    console.log(`  ${r.adapter.padEnd(10)} → ${decision}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
