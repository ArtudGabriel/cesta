/**
 * smoke-test-prod.lib.ts
 *
 * Testable core do smoke-test-prod CLI. Separado do entrypoint pra permitir
 * mock de httpJson em vitest (G3 S188).
 */

export type Deps = {
  httpJson: (path: string) => Promise<unknown>;
  log: (msg: string) => void;
};

export type SectionResult = {
  name: string;
  passed: boolean;
  detail: string;
};

export type SmokeReport = {
  passed: boolean;
  sections: SectionResult[];
};

const EXPECTED_SUPERS = [
  'mercadona',
  'dia',
  'eroski',
  'froiz',
  'aldi',
  'lidl',
] as const;

const MIN_PRODUCTS_TOTAL = 8500;
const MIN_IMAGE_URL_RATIO = 0.7;
const FUZZY_QUERIES: Array<{ q: string; expectedPrefix: string }> = [
  { q: 'lecge', expectedPrefix: 'leche' },
  { q: 'yogrt', expectedPrefix: 'yogur' },
  { q: 'yoguer', expectedPrefix: 'yogur' },
];
const FUZZY_RUNS = 3;

type ProductsPayload = {
  data?: Array<{ id?: string; name?: string; imageUrl?: string | null }>;
  meta?: { pagination?: { total?: number } };
};

type SuggestionsPayload = {
  data?: Array<{ id?: string; name?: string }>;
};

export function checkHealth(body: unknown): SectionResult {
  const ok = !!body && typeof body === 'object' && 'status' in body;
  return {
    name: 'health',
    passed: ok,
    detail: ok ? 'GET /health 200 + shape' : 'health response missing status',
  };
}

export function checkProductsTotal(payload: ProductsPayload): SectionResult {
  const total = payload.meta?.pagination?.total ?? 0;
  const passed = total >= MIN_PRODUCTS_TOTAL;
  return {
    name: 'products-total',
    passed,
    detail: `total=${total} (threshold ≥${MIN_PRODUCTS_TOTAL})`,
  };
}

export function checkSupermarkets(
  payloads: Array<{ slug: string; total: number }>,
): SectionResult {
  const missing: string[] = [];
  const empty: string[] = [];
  for (const slug of EXPECTED_SUPERS) {
    const found = payloads.find((p) => p.slug === slug);
    if (!found) {
      missing.push(slug);
    } else if (found.total <= 0) {
      empty.push(slug);
    }
  }
  const passed = missing.length === 0 && empty.length === 0;
  const parts: string[] = [];
  if (missing.length) parts.push(`missing=[${missing.join(',')}]`);
  if (empty.length) parts.push(`empty=[${empty.join(',')}]`);
  if (passed) {
    parts.push(
      `all 6 supers populated: ${payloads
        .filter((p) => EXPECTED_SUPERS.includes(p.slug as (typeof EXPECTED_SUPERS)[number]))
        .map((p) => `${p.slug}=${p.total}`)
        .join(', ')}`,
    );
  }
  return {
    name: 'supermarkets',
    passed,
    detail: parts.join(' | '),
  };
}

export function checkFuzzyDeterministic(
  runsByQuery: Map<string, SuggestionsPayload[]>,
): SectionResult {
  const failures: string[] = [];
  for (const { q, expectedPrefix } of FUZZY_QUERIES) {
    const runs = runsByQuery.get(q) ?? [];
    if (runs.length < FUZZY_RUNS) {
      failures.push(`${q}: só ${runs.length}/${FUZZY_RUNS} runs coletados`);
      continue;
    }
    const topIds = runs.map((r) => r.data?.[0]?.id ?? null);
    const topNames = runs.map((r) =>
      (r.data?.[0]?.name ?? '').toLowerCase().trim(),
    );
    const allSameId = topIds.every((id) => id !== null && id === topIds[0]);
    if (!allSameId) {
      failures.push(`${q}: topIds não-determinísticos [${topIds.join(', ')}]`);
      continue;
    }
    const prefixOk = topNames[0].startsWith(expectedPrefix);
    if (!prefixOk) {
      failures.push(
        `${q}: top1 "${topNames[0]}" não começa com "${expectedPrefix}"`,
      );
    }
  }
  return {
    name: 'fuzzy-deterministic',
    passed: failures.length === 0,
    detail:
      failures.length === 0
        ? `3/3 queries x 3 runs determinísticos + prefix OK`
        : failures.join(' | '),
  };
}

export function checkImageUrlRatio(payload: ProductsPayload): SectionResult {
  const rows = payload.data ?? [];
  if (rows.length === 0) {
    return {
      name: 'imageUrl-ratio',
      passed: false,
      detail: 'sample vazia — não dá pra calcular ratio',
    };
  }
  const withImage = rows.filter(
    (r) => typeof r.imageUrl === 'string' && r.imageUrl.length > 0,
  ).length;
  const ratio = withImage / rows.length;
  const passed = ratio >= MIN_IMAGE_URL_RATIO;
  return {
    name: 'imageUrl-ratio',
    passed,
    detail: `${withImage}/${rows.length} (${(ratio * 100).toFixed(1)}%, threshold ≥${(MIN_IMAGE_URL_RATIO * 100).toFixed(0)}%)`,
  };
}

export async function runSmokeSuite(deps: Deps): Promise<SmokeReport> {
  const { httpJson, log } = deps;
  const sections: SectionResult[] = [];

  log('── S188 smoke-test-prod — regression S179-S187 ──');

  // 1. Health
  try {
    const body = await httpJson('/health');
    sections.push(checkHealth(body));
  } catch (err) {
    sections.push({
      name: 'health',
      passed: false,
      detail: `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // 2. Products total
  let productsSample: ProductsPayload | null = null;
  try {
    const body = (await httpJson('/products?limit=50&page=1')) as ProductsPayload;
    productsSample = body;
    sections.push(checkProductsTotal(body));
  } catch (err) {
    sections.push({
      name: 'products-total',
      passed: false,
      detail: `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // 3. Supermarkets — por slug conta /products?supermarket=<slug>
  const supersResults: Array<{ slug: string; total: number }> = [];
  for (const slug of EXPECTED_SUPERS) {
    try {
      const body = (await httpJson(
        `/products?supermarket=${slug}&limit=1&page=1`,
      )) as ProductsPayload;
      const total = body.meta?.pagination?.total ?? 0;
      supersResults.push({ slug, total });
    } catch {
      supersResults.push({ slug, total: 0 });
    }
  }
  sections.push(checkSupermarkets(supersResults));

  // 4. Fuzzy chain 3 runs
  const runsByQuery = new Map<string, SuggestionsPayload[]>();
  for (const { q } of FUZZY_QUERIES) {
    const runs: SuggestionsPayload[] = [];
    for (let i = 0; i < FUZZY_RUNS; i += 1) {
      try {
        const body = (await httpJson(
          `/products/suggestions?q=${encodeURIComponent(q)}&limit=5`,
        )) as SuggestionsPayload;
        runs.push(body);
      } catch {
        // deixa run faltante; check marcará insuficiente
      }
    }
    runsByQuery.set(q, runs);
  }
  sections.push(checkFuzzyDeterministic(runsByQuery));

  // 5. imageUrl ratio — reusa sample /products?limit=50
  if (productsSample) {
    sections.push(checkImageUrlRatio(productsSample));
  } else {
    sections.push({
      name: 'imageUrl-ratio',
      passed: false,
      detail: 'sample indisponível (products-total falhou)',
    });
  }

  // Report
  log('');
  for (const s of sections) {
    const tag = s.passed ? 'PASS' : 'FAIL';
    log(`[${tag}] ${s.name}: ${s.detail}`);
  }
  const passed = sections.every((s) => s.passed);
  log('');
  log(
    passed
      ? `✅ ALL ${sections.length} sections PASS`
      : `❌ ${sections.filter((s) => !s.passed).length}/${sections.length} FAIL`,
  );

  return { passed, sections };
}

export const CONSTANTS = {
  EXPECTED_SUPERS,
  MIN_PRODUCTS_TOTAL,
  MIN_IMAGE_URL_RATIO,
  FUZZY_QUERIES,
  FUZZY_RUNS,
} as const;
