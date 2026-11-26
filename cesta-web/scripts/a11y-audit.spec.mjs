import { describe, expect, it } from "vitest";
import {
  summarizeImpact,
  aggregateReports,
  evaluateThreshold,
  auditHtml,
  THRESHOLD,
  AUDITED_ROUTES,
} from "./a11y-audit.mjs";

describe("a11y-audit helpers (Sprint 197 G4)", () => {
  describe("summarizeImpact", () => {
    it("empty violations → zero counts", () => {
      expect(summarizeImpact([])).toEqual({
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
      });
    });

    it("mixed impacts → bucketing", () => {
      const r = summarizeImpact([
        { impact: "critical" },
        { impact: "critical" },
        { impact: "serious" },
        { impact: "minor" },
      ]);
      expect(r).toEqual({ critical: 2, serious: 1, moderate: 0, minor: 1 });
    });

    it("undefined impact → bucket minor (axe default)", () => {
      const r = summarizeImpact([{}, { impact: "serious" }]);
      expect(r.minor).toBe(1);
      expect(r.serious).toBe(1);
    });

    it("unknown impact → ignorado (não crasha)", () => {
      const r = summarizeImpact([{ impact: "mystery" }]);
      expect(r).toEqual({ critical: 0, serious: 0, moderate: 0, minor: 0 });
    });
  });

  describe("aggregateReports", () => {
    it("soma counts cross rotas", () => {
      const r = aggregateReports([
        { counts: { critical: 1, serious: 2, moderate: 0, minor: 3 } },
        { counts: { critical: 0, serious: 1, moderate: 4, minor: 0 } },
      ]);
      expect(r).toEqual({ critical: 1, serious: 3, moderate: 4, minor: 3 });
    });

    it("empty reports → zero totals", () => {
      expect(aggregateReports([])).toEqual({
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
      });
    });

    it("missing impact key → tratado como 0", () => {
      const r = aggregateReports([
        { counts: { critical: 2 } },
      ]);
      expect(r).toEqual({ critical: 2, serious: 0, moderate: 0, minor: 0 });
    });
  });

  describe("evaluateThreshold", () => {
    const t = { maxCritical: 0, maxSerious: 5 };

    it("within threshold → passed=true", () => {
      const v = evaluateThreshold({ critical: 0, serious: 3 }, t);
      expect(v.passed).toBe(true);
      expect(v.reason).toBe("within threshold");
    });

    it("exact match threshold → passed=true (≤)", () => {
      const v = evaluateThreshold({ critical: 0, serious: 5 }, t);
      expect(v.passed).toBe(true);
    });

    it("critical fail dominates", () => {
      const v = evaluateThreshold({ critical: 1, serious: 10 }, t);
      expect(v.passed).toBe(false);
      expect(v.criticalFail).toBe(true);
      expect(v.reason).toContain("critical 1 > 0");
    });

    it("serious fail quando critical=0 mas serious excede", () => {
      const v = evaluateThreshold({ critical: 0, serious: 6 }, t);
      expect(v.passed).toBe(false);
      expect(v.seriousFail).toBe(true);
      expect(v.criticalFail).toBe(false);
      expect(v.reason).toContain("serious 6 > 5");
    });
  });

  // Integração live (auditHtml com JSDOM + axe-core) é exercida apenas em CI
  // step a11y:audit (Next start + fetch rotas); vitest env jsdom conflita com
  // o JSDOM instance separado que o helper cria, causando axe.run arg errors.
  // Pure helpers (summarize/aggregate/evaluate) cobrem a lógica de threshold
  // que é o que CI gate precisa validar.
  describe("auditHtml (export surface)", () => {
    it("export existe e é async function", () => {
      expect(typeof auditHtml).toBe("function");
      expect(auditHtml.constructor.name).toBe("AsyncFunction");
    });
  });

  describe("constants", () => {
    it("THRESHOLD default matches spec", () => {
      expect(THRESHOLD).toEqual({ maxCritical: 0, maxSerious: 5 });
    });

    it("AUDITED_ROUTES cobre 6 rotas boss DoD", () => {
      const paths = AUDITED_ROUTES.map((r) => r.path);
      expect(paths).toEqual([
        "/",
        "/produto/sample-product-id",
        "/comparar",
        "/favoritos",
        "/login",
        "/perfil",
      ]);
    });
  });
});
