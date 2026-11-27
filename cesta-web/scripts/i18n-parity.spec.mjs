import { describe, expect, it } from "vitest";
import {
  flatten,
  collectTodos,
  diffLocales,
  extractPlaceholders,
  diffPlaceholders,
} from "./i18n-parity.mjs";

describe("i18n-parity helpers (Sprint 196 G1)", () => {
  describe("flatten", () => {
    it("flattens single leaf", () => {
      const r = flatten({ a: "x" });
      expect(r).toEqual({ a: { path: "a", type: "leaf" } });
    });

    it("flattens nested object with branch + leaf entries", () => {
      const r = flatten({ a: { b: "x", c: "y" } });
      expect(r).toEqual({
        a: { path: "a", type: "branch" },
        "a.b": { path: "a.b", type: "leaf" },
        "a.c": { path: "a.c", type: "leaf" },
      });
    });

    it("3-level nesting preserves dot path", () => {
      const r = flatten({ a: { b: { c: "deep" } } });
      expect(r["a.b.c"]).toEqual({ path: "a.b.c", type: "leaf" });
      expect(r["a.b"].type).toBe("branch");
    });

    it("arrays treated como leaves (não recursa)", () => {
      const r = flatten({ list: ["x", "y"] });
      expect(r.list.type).toBe("leaf");
      expect(r["list.0"]).toBeUndefined();
    });
  });

  describe("collectTodos", () => {
    it("empty quando sem TODO", () => {
      expect(collectTodos({ a: "ok", b: { c: "done" } })).toEqual([]);
    });

    it("captura TODO: nested path", () => {
      const r = collectTodos({
        a: "clean",
        b: { c: "TODO: translate" },
        d: "TODO: another",
      });
      expect(r).toEqual(["b.c", "d"]);
    });
  });

  describe("diffLocales", () => {
    it("parity full → zero entries em qualquer lista", () => {
      const es = { app: { title: "Cesta" }, nav: { home: "Inicio" } };
      const pt = { app: { title: "Cesta" }, nav: { home: "Início" } };
      expect(diffLocales(es, pt)).toEqual({
        onlyEs: [],
        onlyPt: [],
        typeMismatch: [],
      });
    });

    it("key only ES → onlyEs populated", () => {
      const es = { a: "x", b: "y" };
      const pt = { a: "x" };
      const r = diffLocales(es, pt);
      expect(r.onlyEs).toEqual(["b"]);
      expect(r.onlyPt).toEqual([]);
    });

    it("key only PT → onlyPt populated", () => {
      const es = { a: "x" };
      const pt = { a: "x", c: "z" };
      const r = diffLocales(es, pt);
      expect(r.onlyPt).toEqual(["c"]);
      expect(r.onlyEs).toEqual([]);
    });

    it("type mismatch: leaf vs branch", () => {
      const es = { a: "leaf value" };
      const pt = { a: { b: "nested" } };
      const r = diffLocales(es, pt);
      expect(r.typeMismatch).toEqual([
        { path: "a", es: "leaf", pt: "branch" },
      ]);
    });

    it("nested only on one side: reports path incompleto", () => {
      const es = { a: { b: "x", c: "y" } };
      const pt = { a: { b: "x" } };
      const r = diffLocales(es, pt);
      expect(r.onlyEs).toContain("a.c");
      expect(r.onlyPt).toEqual([]);
    });
  });

  describe("extractPlaceholders", () => {
    it("string sem placeholder → []", () => {
      expect(extractPlaceholders("hello world")).toEqual([]);
    });

    it("simple placeholder", () => {
      expect(extractPlaceholders("Hello {name}")).toEqual(["name"]);
    });

    it("multiple placeholders ordenados", () => {
      expect(extractPlaceholders("{b} and {a}")).toEqual(["a", "b"]);
    });

    it("ICU plural: só captura var top-level, ignora literal nested", () => {
      const s = "{count, plural, =0 {Sin productos} other {# productos}}";
      expect(extractPlaceholders(s)).toEqual(["count"]);
    });

    it("ICU select: ignora branch literal text", () => {
      const s = "{gender, select, male {Él} female {Ella} other {Elle}}";
      expect(extractPlaceholders(s)).toEqual(["gender"]);
    });
  });

  describe("diffPlaceholders", () => {
    it("paridade full → []", () => {
      const es = { a: "Hello {name}" };
      const pt = { a: "Olá {name}" };
      expect(diffPlaceholders(es, pt)).toEqual([]);
    });

    it("placeholder renomeado em ES mas não em PT → diff", () => {
      const es = { a: "Desde {date}" };
      const pt = { a: "Desde {since}" };
      const r = diffPlaceholders(es, pt);
      expect(r).toEqual([{ path: "a", es: ["date"], pt: ["since"] }]);
    });

    it("key sem par em PT → skip (coberto por diffLocales)", () => {
      const es = { a: "{x}" };
      const pt = {};
      expect(diffPlaceholders(es, pt)).toEqual([]);
    });
  });
});
