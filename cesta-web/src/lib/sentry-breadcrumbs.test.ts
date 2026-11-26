import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const addBreadcrumbMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: (...args: unknown[]) => addBreadcrumbMock(...args),
}));

import {
  queryLengthBucket,
  recordAuthAttempt,
  recordProductsFetch,
  recordSuggestRequest,
  sanitizeFilters,
} from "./sentry-breadcrumbs";

describe("sentry-breadcrumbs (Sprint 192 G2)", () => {
  beforeEach(() => {
    addBreadcrumbMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("queryLengthBucket", () => {
    it.each([
      ["", "0"],
      ["a", "1-2"],
      ["ab", "1-2"],
      ["abc", "3-5"],
      ["abcde", "3-5"],
      ["abcdef", "6-10"],
      ["abcdefghij", "6-10"],
      ["abcdefghijk", "11+"],
      ["long query with spaces and stuff", "11+"],
    ])("bucket '%s' → %s", (input, expected) => {
      expect(queryLengthBucket(input)).toBe(expected);
    });
  });

  describe("sanitizeFilters (GDPR S59 no-PII)", () => {
    it("whitelist deixa passar supermarket/category/sort/page/limit", () => {
      const r = sanitizeFilters({
        supermarket: "mercadona",
        category: "lacteos",
        sort: "price_asc",
        page: 2,
        limit: 24,
      });
      expect(r).toEqual({
        supermarket: "mercadona",
        category: "lacteos",
        sort: "price_asc",
        page: 2,
        limit: 24,
      });
    });

    it("drop free-text search/q (PII potencial)", () => {
      const r = sanitizeFilters({
        search: "user typed stuff",
        q: "something",
        supermarket: "dia",
      });
      expect(r).toEqual({ supermarket: "dia" });
      expect(r).not.toHaveProperty("search");
      expect(r).not.toHaveProperty("q");
    });

    it("drop unknown keys + undefined/null values", () => {
      const r = sanitizeFilters({
        unknownField: "secret",
        supermarket: null,
        category: undefined,
        sort: "name_asc",
      });
      expect(r).toEqual({ sort: "name_asc" });
    });

    it("drop valores complexos (objects/arrays)", () => {
      const r = sanitizeFilters({
        supermarket: { slug: "x" } as unknown as string,
        category: ["a", "b"] as unknown as string,
        sort: "ok",
      });
      expect(r).toEqual({ sort: "ok" });
    });
  });

  describe("recordSuggestRequest", () => {
    it("start: emite breadcrumb category api.suggest info com bucket mas NÃO query", () => {
      recordSuggestRequest("start", { query: "leche entera" });

      expect(addBreadcrumbMock).toHaveBeenCalledTimes(1);
      const b = addBreadcrumbMock.mock.calls[0][0];
      expect(b.category).toBe("api.suggest");
      expect(b.level).toBe("info");
      expect(b.data).toEqual({
        stage: "start",
        q_len_bucket: "11+",
      });
      // GDPR assertion: raw query NUNCA aparece no payload
      expect(JSON.stringify(b)).not.toContain("leche entera");
    });

    it("success: result_count + status + duration_ms", () => {
      recordSuggestRequest("success", {
        query: "abc",
        resultCount: 5,
        status: 200,
        durationMs: 123,
      });
      const b = addBreadcrumbMock.mock.calls[0][0];
      expect(b.data).toEqual({
        stage: "success",
        q_len_bucket: "3-5",
        result_count: 5,
        status: 200,
        duration_ms: 123,
      });
    });

    it("failure: warning level + error_code", () => {
      recordSuggestRequest("failure", {
        query: "xy",
        status: 500,
        errorCode: "INTERNAL_ERROR",
      });
      const b = addBreadcrumbMock.mock.calls[0][0];
      expect(b.level).toBe("warning");
      expect(b.type).toBe("error");
      expect(b.data.error_code).toBe("INTERNAL_ERROR");
    });
  });

  describe("recordProductsFetch", () => {
    it("success: route + filters sanitized + total + success=true", () => {
      recordProductsFetch({
        route: "/products",
        filters: {
          supermarket: "mercadona",
          search: "LEAKED TEXT",
          page: 1,
        },
        resultCount: 24,
        total: 4006,
        status: 200,
        success: true,
      });
      const b = addBreadcrumbMock.mock.calls[0][0];
      expect(b.category).toBe("api.products");
      expect(b.level).toBe("info");
      expect(b.data.filters).toEqual({
        supermarket: "mercadona",
        page: 1,
      });
      expect(b.data.result_count).toBe(24);
      expect(b.data.total).toBe(4006);
      expect(JSON.stringify(b)).not.toContain("LEAKED TEXT");
    });

    it("failure: warning + error_code presente", () => {
      recordProductsFetch({
        route: "/products",
        status: 503,
        errorCode: "SERVICE_UNAVAILABLE",
        success: false,
      });
      const b = addBreadcrumbMock.mock.calls[0][0];
      expect(b.level).toBe("warning");
      expect(b.data.success).toBe(false);
      expect(b.data.error_code).toBe("SERVICE_UNAVAILABLE");
    });
  });

  describe("recordAuthAttempt", () => {
    it("login success: kind + outcome + status", () => {
      recordAuthAttempt({
        kind: "login",
        outcome: "success",
        status: 200,
        durationMs: 450,
      });
      const b = addBreadcrumbMock.mock.calls[0][0];
      expect(b.category).toBe("api.auth");
      expect(b.data).toEqual({
        kind: "login",
        outcome: "success",
        status: 200,
        duration_ms: 450,
      });
    });

    it("register failure: warning + error_code", () => {
      recordAuthAttempt({
        kind: "register",
        outcome: "failure",
        status: 409,
        errorCode: "EMAIL_ALREADY_EXISTS",
      });
      const b = addBreadcrumbMock.mock.calls[0][0];
      expect(b.level).toBe("warning");
      expect(b.data.outcome).toBe("failure");
      expect(b.data.error_code).toBe("EMAIL_ALREADY_EXISTS");
    });

    it("login challenge_2fa: outcome específico", () => {
      recordAuthAttempt({
        kind: "login",
        outcome: "challenge_2fa",
        status: 200,
      });
      const b = addBreadcrumbMock.mock.calls[0][0];
      expect(b.level).toBe("info");
      expect(b.data.outcome).toBe("challenge_2fa");
    });

    it("GDPR: email/senha/userId NUNCA no payload", () => {
      recordAuthAttempt({
        kind: "login",
        outcome: "success",
        status: 200,
      });
      const b = addBreadcrumbMock.mock.calls[0][0];
      const serialized = JSON.stringify(b);
      // Keys que jamais devem vazar
      expect(serialized).not.toMatch(/email/i);
      expect(serialized).not.toMatch(/password/i);
      expect(serialized).not.toMatch(/userId/i);
      expect(serialized).not.toMatch(/token/i);
    });
  });

  describe("observability safety", () => {
    it("Sentry.addBreadcrumb throw não propaga", () => {
      addBreadcrumbMock.mockImplementationOnce(() => {
        throw new Error("sentry down");
      });
      expect(() =>
        recordSuggestRequest("start", { query: "ok" }),
      ).not.toThrow();
    });
  });
});
