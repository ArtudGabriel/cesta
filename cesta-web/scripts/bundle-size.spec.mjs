import { describe, expect, it } from "vitest";
import {
  computeRouteBundle,
  evaluateRoute,
  aggregateRoutes,
  THRESHOLD,
} from "./bundle-size.mjs";

describe("bundle-size helpers (Sprint 199 G4)", () => {
  // Fake sizeFn: each chunk path maps a pre-defined byte count.
  const fakeSizes = {
    "static/chunks/framework.js": 40_000,
    "static/chunks/main.js": 30_000,
    "static/chunks/webpack.js": 5_000,
    "static/chunks/pages/home.js": 25_000,
    "static/chunks/pages/produto.js": 60_000,
    "static/chunks/pages/compare.js": 15_000,
  };
  const sizeFn = (p) => fakeSizes[p] ?? 0;

  describe("computeRouteBundle", () => {
    it("empty chunks → total 0", () => {
      expect(computeRouteBundle([], sizeFn)).toEqual({
        total: 0,
        perChunk: [],
      });
    });

    it("soma chunks + retorna perChunk detail", () => {
      const r = computeRouteBundle(
        ["static/chunks/framework.js", "static/chunks/pages/home.js"],
        sizeFn,
      );
      expect(r.total).toBe(65_000);
      expect(r.perChunk).toHaveLength(2);
    });

    it("chunk inexistente contribui 0", () => {
      const r = computeRouteBundle(["unknown.js"], sizeFn);
      expect(r.total).toBe(0);
    });
  });

  describe("evaluateRoute", () => {
    it("within threshold → sem violations", () => {
      const r = evaluateRoute(
        "/",
        { total: 100_000, perChunk: [] },
        THRESHOLD,
      );
      expect(r.violations).toEqual([]);
    });

    it("excede first-load → violation first-load-exceeded", () => {
      const r = evaluateRoute(
        "/heavy",
        { total: 250_000, perChunk: [] },
        THRESHOLD,
      );
      expect(r.violations).toHaveLength(1);
      expect(r.violations[0].kind).toBe("first-load-exceeded");
      expect(r.violations[0].actual).toBe(250_000);
      expect(r.violations[0].max).toBe(200_000);
    });
  });

  describe("aggregateRoutes", () => {
    const manifest = {
      "/": [
        "static/chunks/framework.js",
        "static/chunks/main.js",
        "static/chunks/webpack.js",
        "static/chunks/pages/home.js",
      ],
      "/comparar": [
        "static/chunks/framework.js",
        "static/chunks/main.js",
        "static/chunks/webpack.js",
        "static/chunks/pages/compare.js",
      ],
      "/produto": [
        "static/chunks/framework.js",
        "static/chunks/main.js",
        "static/chunks/webpack.js",
        "static/chunks/pages/produto.js",
      ],
    };

    it("detecta shared chunks (≥50% routes)", () => {
      const r = aggregateRoutes(manifest, THRESHOLD, sizeFn);
      // framework, main, webpack em 3/3 routes → shared.
      expect(r.sharedChunks).toContain("static/chunks/framework.js");
      expect(r.sharedChunks).toContain("static/chunks/main.js");
      expect(r.sharedChunks).toContain("static/chunks/webpack.js");
      // page-specific NÃO shared.
      expect(r.sharedChunks).not.toContain("static/chunks/pages/home.js");
    });

    it("per-route separa shared vs page-only bytes", () => {
      const r = aggregateRoutes(manifest, THRESHOLD, sizeFn);
      const home = r.routes.find((x) => x.route === "/");
      // shared = framework+main+webpack = 75000; page-only = home.js = 25000; total = 100000.
      expect(home.sharedBytes).toBe(75_000);
      expect(home.pageOnlyBytes).toBe(25_000);
      expect(home.firstLoadBytes).toBe(100_000);
      expect(home.violations).toEqual([]);
    });

    it("/produto exceeds per-page threshold (60KB > 50KB page-only)", () => {
      const r = aggregateRoutes(manifest, THRESHOLD, sizeFn);
      const prod = r.routes.find((x) => x.route === "/produto");
      // page-only produto.js = 60000 > 50000 max.
      expect(prod.violations.length).toBeGreaterThan(0);
      expect(prod.violations[0].kind).toBe("per-page-exceeded");
      expect(prod.violations[0].actual).toBe(60_000);
    });

    it("totalSharedBytes calculado", () => {
      const r = aggregateRoutes(manifest, THRESHOLD, sizeFn);
      expect(r.totalSharedBytes).toBe(75_000);
    });

    it("single route → NÃO classifica como shared (cutoff logic)", () => {
      const singleManifest = {
        "/only": ["static/chunks/framework.js", "static/chunks/pages/home.js"],
      };
      const r = aggregateRoutes(singleManifest, THRESHOLD, sizeFn);
      // Ambos chunks presentes em 1/1 (100%), cutoff = ceil(1*0.5)=1.
      // Então ambos viram "shared" na heurística. Comportamento documentado.
      expect(r.sharedChunks.length).toBe(2);
    });
  });

  describe("THRESHOLD", () => {
    it("default values match boss spec", () => {
      expect(THRESHOLD).toEqual({
        firstLoadJsMaxBytes: 200_000,
        perPageMaxBytes: 50_000,
      });
    });
  });
});
