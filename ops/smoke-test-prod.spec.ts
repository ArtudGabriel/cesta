import { describe, it, expect } from 'vitest';
import {
  checkHealth,
  checkProductsTotal,
  checkSupermarkets,
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

    it('all pass path: retorna passed=true + exit-ready report', async () => {
      const logs: string[] = [];
      const deps = mkDeps(async (path: string) => {
        if (path === '/health') return { status: 'ok' };
        if (path.startsWith('/products?supermarket=')) {
          return { data: [], meta: { pagination: { total: 100 } } };
        }
        if (path.startsWith('/products?limit=50')) {
          return okProducts(9500, 0.8);
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
      }, logs);

      const report = await runSmokeSuite(deps);
      expect(report.passed).toBe(true);
      expect(report.sections).toHaveLength(5);
      expect(report.sections.every((s) => s.passed)).toBe(true);
      expect(logs.some((l) => l.includes('ALL 5 sections PASS'))).toBe(true);
    });

    it('health fail path: report.passed=false + section fail', async () => {
      const logs: string[] = [];
      const deps = mkDeps(async (path: string) => {
        if (path === '/health') throw new Error('ECONNREFUSED');
        if (path.startsWith('/products?supermarket=')) {
          return { data: [], meta: { pagination: { total: 100 } } };
        }
        if (path.startsWith('/products?limit=50')) {
          return okProducts(9500, 0.8);
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
      }, logs);

      const report = await runSmokeSuite(deps);
      expect(report.passed).toBe(false);
      const healthSection = report.sections.find((s) => s.name === 'health');
      expect(healthSection?.passed).toBe(false);
      expect(healthSection?.detail).toContain('ECONNREFUSED');
    });

    it('low products total path: products-total fail + imageUrl section ainda roda', async () => {
      const logs: string[] = [];
      const deps = mkDeps(async (path: string) => {
        if (path === '/health') return { status: 'ok' };
        if (path.startsWith('/products?supermarket=')) {
          return { data: [], meta: { pagination: { total: 100 } } };
        }
        if (path.startsWith('/products?limit=50')) {
          return okProducts(5000, 0.8);
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
      }, logs);

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
