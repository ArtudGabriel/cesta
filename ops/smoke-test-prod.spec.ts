import { describe, it, expect } from 'vitest';
import {
  checkHealth,
  checkAuthHealth,
  checkProductsTotal,
  checkSupermarkets,
  checkPerSuperThresholds,
  checkFuzzyQuery,
  checkFuzzyDeterministic,
  checkImageUrlRatio,
  runSmokeSuite,
  CONSTANTS,
  type Deps,
} from './smoke-test-prod.lib.js';

describe('smoke-test-prod.lib (S188 G3)', () => {
  describe('checkHealth', () => {
    it('passa quando response tem shape status', () => {
      const r = checkHealth({ status: 'ok' });
      expect(r.passed).toBe(true);
      expect(r.name).toBe('health');
    });

    it('falha quando body não tem status', () => {
      const r = checkHealth({ msg: 'ok' });
      expect(r.passed).toBe(false);
    });

    it('falha quando body é null', () => {
      const r = checkHealth(null);
      expect(r.passed).toBe(false);
    });
  });

  // Sprint 189 G1 (c)
  describe('checkAuthHealth', () => {
    it('passa com qualquer JSON object válido', () => {
      const r = checkAuthHealth({ status: 'ok', version: '1' });
      expect(r.passed).toBe(true);
      expect(r.name).toBe('auth-health');
    });

    it('falha com null', () => {
      const r = checkAuthHealth(null);
      expect(r.passed).toBe(false);
    });

    it('falha com string (não JSON object)', () => {
      const r = checkAuthHealth('ok');
      expect(r.passed).toBe(false);
    });
  });

  // Sprint 189 G1 (b)
  describe('checkPerSuperThresholds', () => {
    it('passa quando todos os 6 supers acima da baseline', () => {
      const payloads = [
        { slug: 'mercadona', total: 4000 },
        { slug: 'dia', total: 2900 },
        { slug: 'eroski', total: 700 },
        { slug: 'froiz', total: 400 },
        { slug: 'aldi', total: 150 },
        { slug: 'lidl', total: 900 },
      ];
      const r = checkPerSuperThresholds(payloads);
      expect(r.passed).toBe(true);
      expect(r.detail).toContain('all 6 supers above threshold');
    });

    it('falha quando algum super abaixo do threshold (lidl S186 bottleneck pattern)', () => {
      const payloads = [
        { slug: 'mercadona', total: 4000 },
        { slug: 'dia', total: 2900 },
        { slug: 'eroski', total: 700 },
        { slug: 'froiz', total: 400 },
        { slug: 'aldi', total: 150 },
        { slug: 'lidl', total: 41 }, // S186 pre-fix state
      ];
      const r = checkPerSuperThresholds(payloads);
      expect(r.passed).toBe(false);
      expect(r.detail).toContain('lidl=41');
      expect(r.detail).toContain('min 600');
    });

    it('falha quando super ausente (total=0 implicit)', () => {
      const payloads = [
        { slug: 'mercadona', total: 4000 },
      ];
      const r = checkPerSuperThresholds(payloads);
      expect(r.passed).toBe(false);
      expect(r.detail).toContain('dia=0');
    });

    it('CONSTANTS carrega os 6 supers ativos + lidl 600 baseline S186', () => {
      expect(Object.keys(CONSTANTS.PER_SUPER_MIN_TOTALS)).toEqual([
        'mercadona',
        'dia',
        'eroski',
        'froiz',
        'aldi',
        'lidl',
      ]);
      expect(CONSTANTS.PER_SUPER_MIN_TOTALS.lidl).toBe(600);
      expect(CONSTANTS.PER_SUPER_MIN_TOTALS.mercadona).toBe(2800);
    });
  });

  // Sprint 189 G1 (a)
  describe('checkFuzzyQuery (per-query granular)', () => {
    const makeRuns = (name: string, id = 'p1') =>
      Array.from({ length: CONSTANTS.FUZZY_RUNS }, () => ({
        data: [{ id, name }],
      }));

    it('passa quando 3/3 runs mesmo topId + prefix OK', () => {
      const r = checkFuzzyQuery('lecge', 'leche', makeRuns('Leche entera 1L'));
      expect(r.passed).toBe(true);
      expect(r.name).toBe('fuzzy-lecge');
      expect(r.detail).toContain('3/3');
    });

    it('falha quando runs insuficientes', () => {
      const r = checkFuzzyQuery('lecge', 'leche', [
        { data: [{ id: 'p1', name: 'Leche' }] },
      ]);
      expect(r.passed).toBe(false);
      expect(r.detail).toContain('1/3');
    });

    it('falha quando topIds variam entre runs (não-determinístico S185 regression)', () => {
      const r = checkFuzzyQuery('lecge', 'leche', [
        { data: [{ id: 'p-leche', name: 'Leche' }] },
        { data: [{ id: 'p-lechuga', name: 'Lechuga' }] },
        { data: [{ id: 'p-leche', name: 'Leche' }] },
      ]);
      expect(r.passed).toBe(false);
      expect(r.detail).toContain('não-determinísticos');
    });

    it('falha quando prefix wrong (S182 regression pattern)', () => {
      const r = checkFuzzyQuery(
        'lecge',
        'leche',
        makeRuns('Lechuga iceberg', 'p-lechuga'),
      );
      expect(r.passed).toBe(false);
      expect(r.detail).toContain('não começa com "leche"');
    });
  });

  describe('checkProductsTotal', () => {
    it('passa quando total atinge threshold', () => {
      const r = checkProductsTotal({
        meta: { pagination: { total: CONSTANTS.MIN_PRODUCTS_TOTAL } },
      });
      expect(r.passed).toBe(true);
    });

    it('passa acima do threshold', () => {
      const r = checkProductsTotal({
        meta: { pagination: { total: 9500 } },
      });
      expect(r.passed).toBe(true);
      expect(r.detail).toContain('9500');
    });

    it('falha abaixo do threshold', () => {
      const r = checkProductsTotal({
        meta: { pagination: { total: CONSTANTS.MIN_PRODUCTS_TOTAL - 1 } },
      });
      expect(r.passed).toBe(false);
    });

    it('falha quando meta ausente (treat as 0)', () => {
      const r = checkProductsTotal({});
      expect(r.passed).toBe(false);
      expect(r.detail).toContain('total=0');
    });
  });

  describe('checkSupermarkets', () => {
    it('passa quando todos 6 supers com total > 0', () => {
      const payloads = CONSTANTS.EXPECTED_SUPERS.map((slug) => ({
        slug,
        total: 100,
      }));
      const r = checkSupermarkets(payloads);
      expect(r.passed).toBe(true);
    });

    it('falha quando algum super faltando', () => {
      const payloads = CONSTANTS.EXPECTED_SUPERS.slice(0, 5).map((slug) => ({
        slug,
        total: 100,
      }));
      const r = checkSupermarkets(payloads);
      expect(r.passed).toBe(false);
      expect(r.detail).toContain('missing=');
      expect(r.detail).toContain('lidl');
    });

    it('falha quando algum super com total 0', () => {
      const payloads = CONSTANTS.EXPECTED_SUPERS.map((slug) => ({
        slug,
        total: slug === 'lidl' ? 0 : 100,
      }));
      const r = checkSupermarkets(payloads);
      expect(r.passed).toBe(false);
      expect(r.detail).toContain('empty=');
      expect(r.detail).toContain('lidl');
    });
  });

  describe('checkFuzzyDeterministic', () => {
    const makeRuns = (name: string) =>
      Array.from({ length: CONSTANTS.FUZZY_RUNS }, () => ({
        data: [{ id: 'p1', name }],
      }));

    it('passa 3/3 queries x 3 runs determinísticos + prefix OK', () => {
      const runsByQuery = new Map([
        ['lecge', makeRuns('Leche entera 1L')],
        ['yogrt', makeRuns('Yogur natural')],
        ['yoguer', makeRuns('Yogur frutas')],
      ]);
      const r = checkFuzzyDeterministic(runsByQuery);
      expect(r.passed).toBe(true);
    });

    it('falha quando runs insuficientes', () => {
      const runsByQuery = new Map([
        ['lecge', [{ data: [{ id: 'p1', name: 'Leche' }] }]],
        ['yogrt', makeRuns('Yogur natural')],
        ['yoguer', makeRuns('Yogur frutas')],
      ]);
      const r = checkFuzzyDeterministic(runsByQuery);
      expect(r.passed).toBe(false);
      expect(r.detail).toContain('lecge');
      expect(r.detail).toContain('1/3');
    });

    it('falha quando topIds não-determinísticos entre runs', () => {
      const runsByQuery = new Map([
        [
          'lecge',
          [
            { data: [{ id: 'p1', name: 'Leche A' }] },
            { data: [{ id: 'p2', name: 'Leche B' }] },
            { data: [{ id: 'p1', name: 'Leche A' }] },
          ],
        ],
        ['yogrt', makeRuns('Yogur natural')],
        ['yoguer', makeRuns('Yogur frutas')],
      ]);
      const r = checkFuzzyDeterministic(runsByQuery);
      expect(r.passed).toBe(false);
      expect(r.detail).toContain('não-determinísticos');
    });

    it('falha quando top1 não começa com expectedPrefix', () => {
      const runsByQuery = new Map([
        ['lecge', makeRuns('Lechuga iceberg')],
        ['yogrt', makeRuns('Yogur natural')],
        ['yoguer', makeRuns('Yogur frutas')],
      ]);
      const r = checkFuzzyDeterministic(runsByQuery);
      expect(r.passed).toBe(false);
      expect(r.detail).toContain('não começa com "leche"');
    });
  });

  describe('checkImageUrlRatio', () => {
    it('passa quando ratio ≥ threshold', () => {
      const data = Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`,
        name: `Produto ${i}`,
        imageUrl: i < 7 ? `https://r2.cesta/p${i}.webp` : null,
      }));
      const r = checkImageUrlRatio({ data });
      expect(r.passed).toBe(true);
      expect(r.detail).toContain('7/10');
    });

    it('falha quando ratio < threshold', () => {
      const data = Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`,
        name: `Produto ${i}`,
        imageUrl: i < 5 ? `https://r2.cesta/p${i}.webp` : null,
      }));
      const r = checkImageUrlRatio({ data });
      expect(r.passed).toBe(false);
    });

    it('falha quando sample vazia', () => {
      const r = checkImageUrlRatio({ data: [] });
      expect(r.passed).toBe(false);
      expect(r.detail).toContain('vazia');
    });
  });

  describe('runSmokeSuite (integration via mock)', () => {
    const mkDeps = (
      mock: (path: string) => Promise<unknown>,
      logs: string[],
    ): Deps => ({
      httpJson: mock,
      log: (msg) => logs.push(msg),
    });

    const okProducts = (total: number, imgRatio: number) => ({
      data: Array.from({ length: 50 }, (_, i) => ({
        id: `p${i}`,
        name: `Prod ${i}`,
        imageUrl: i < Math.floor(50 * imgRatio) ? `img-${i}` : null,
      })),
      meta: { pagination: { total } },
    });

    // Mock retorna per-super totals compatíveis com PER_SUPER_MIN_TOTALS
    const okSuperTotals: Record<string, number> = {
      mercadona: 4000,
      dia: 2900,
      eroski: 700,
      froiz: 400,
      aldi: 150,
      lidl: 900,
    };

    const okMock = (
      overrides: Partial<{
        productsTotal: number;
        imgRatio: number;
        superTotals: Record<string, number>;
        healthThrows: boolean;
        authHealthThrows: boolean;
      }> = {},
    ) => {
      const productsTotal = overrides.productsTotal ?? 9500;
      const imgRatio = overrides.imgRatio ?? 0.8;
      const superTotals = overrides.superTotals ?? okSuperTotals;
      return async (path: string) => {
        if (path === '/health') {
          if (overrides.healthThrows) throw new Error('ECONNREFUSED');
          return { status: 'ok' };
        }
        if (path === '/auth/health') {
          if (overrides.authHealthThrows) throw new Error('ECONNREFUSED');
          return { status: 'ok', module: 'auth' };
        }
        if (path.startsWith('/products?supermarket=')) {
          const slug = path.match(/supermarket=([^&]+)/)?.[1] ?? '';
          return {
            data: [],
            meta: { pagination: { total: superTotals[slug] ?? 0 } },
          };
        }
        if (path.startsWith('/products?limit=50')) {
          return okProducts(productsTotal, imgRatio);
        }
        if (path.startsWith('/products/suggestions?q=lecge')) {
          return { data: [{ id: 'p-leche', name: 'Leche entera 1L' }] };
        }
        if (path.startsWith('/products/suggestions?q=yogrt')) {
          return { data: [{ id: 'p-yogur-a', name: 'Yogur natural' }] };
        }
        if (path.startsWith('/products/suggestions?q=yoguer')) {
          return { data: [{ id: 'p-yogur-b', name: 'Yogur frutas' }] };
        }
        throw new Error(`Unexpected path: ${path}`);
      };
    };

    it('all pass path: retorna passed=true + 9 sections (S189 expanded)', async () => {
      const logs: string[] = [];
      const deps = mkDeps(okMock(), logs);

      const report = await runSmokeSuite(deps);
      expect(report.passed).toBe(true);
      // 9 sections: health, auth-health, products-total, supermarkets,
      // per-super-thresholds, fuzzy-lecge, fuzzy-yogrt, fuzzy-yoguer, imageUrl-ratio
      expect(report.sections).toHaveLength(9);
      expect(report.sections.every((s) => s.passed)).toBe(true);
      const names = report.sections.map((s) => s.name);
      expect(names).toContain('auth-health');
      expect(names).toContain('per-super-thresholds');
      expect(names).toContain('fuzzy-lecge');
      expect(names).toContain('fuzzy-yogrt');
      expect(names).toContain('fuzzy-yoguer');
      expect(logs.some((l) => l.includes('ALL 9 sections PASS'))).toBe(true);
    });

    it('health fail path: report.passed=false + section fail', async () => {
      const logs: string[] = [];
      const deps = mkDeps(okMock({ healthThrows: true }), logs);

      const report = await runSmokeSuite(deps);
      expect(report.passed).toBe(false);
      const healthSection = report.sections.find((s) => s.name === 'health');
      expect(healthSection?.passed).toBe(false);
      expect(healthSection?.detail).toContain('ECONNREFUSED');
    });

    it('auth-health fail path: section fail isolado (não derruba /health)', async () => {
      const logs: string[] = [];
      const deps = mkDeps(okMock({ authHealthThrows: true }), logs);

      const report = await runSmokeSuite(deps);
      expect(report.passed).toBe(false);
      const authSec = report.sections.find((s) => s.name === 'auth-health');
      expect(authSec?.passed).toBe(false);
      const healthSec = report.sections.find((s) => s.name === 'health');
      expect(healthSec?.passed).toBe(true);
    });

    it('per-super threshold fail (lidl pre-S186 pattern)', async () => {
      const logs: string[] = [];
      const deps = mkDeps(
        okMock({
          superTotals: { ...okSuperTotals, lidl: 41 },
        }),
        logs,
      );

      const report = await runSmokeSuite(deps);
      expect(report.passed).toBe(false);
      const perSuperSec = report.sections.find(
        (s) => s.name === 'per-super-thresholds',
      );
      expect(perSuperSec?.passed).toBe(false);
      expect(perSuperSec?.detail).toContain('lidl=41');
      // supermarkets (presence only) ainda passa — valida independência dos checks
      const presenceSec = report.sections.find((s) => s.name === 'supermarkets');
      expect(presenceSec?.passed).toBe(true);
    });

    it('low products total path: products-total fail + imageUrl section ainda roda', async () => {
      const logs: string[] = [];
      const deps = mkDeps(okMock({ productsTotal: 5000 }), logs);

      const report = await runSmokeSuite(deps);
      expect(report.passed).toBe(false);
      const totalSec = report.sections.find((s) => s.name === 'products-total');
      expect(totalSec?.passed).toBe(false);
      const imgSec = report.sections.find((s) => s.name === 'imageUrl-ratio');
      expect(imgSec).toBeDefined();
      expect(imgSec?.passed).toBe(true);
    });
  });
});
