import { afterEach, describe, it, expect, vi } from "vitest";
import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import { CLIENT_API_BASE_URL, api, refreshAccessToken, shouldRetryOnNetworkError } from "./api";

function makeConfig(
  partial: Partial<InternalAxiosRequestConfig> & { _networkRetried?: boolean },
): InternalAxiosRequestConfig & { _networkRetried?: boolean } {
  return {
    headers: new AxiosHeaders(),
    ...partial,
  } as InternalAxiosRequestConfig & { _networkRetried?: boolean };
}

function makeError(opts: {
  code?: string;
  status?: number;
  config?: InternalAxiosRequestConfig & { _networkRetried?: boolean };
}): AxiosError {
  const err = new AxiosError(opts.code ?? "ERR", opts.code, opts.config);
  if (opts.status !== undefined) {
    err.response = {
      status: opts.status,
      statusText: "",
      data: {},
      headers: {},
      config: opts.config ?? makeConfig({}),
    } as AxiosError["response"];
  }
  return err;
}

describe("shouldRetryOnNetworkError", () => {
  it("GET + ECONNABORTED não retentado → retry", () => {
    const config = makeConfig({ method: "get", url: "/x" });
    expect(
      shouldRetryOnNetworkError(
        makeError({ code: "ECONNABORTED", config }),
        config,
      ),
    ).toBe(true);
  });

  it("GET + ERR_NETWORK não retentado → retry", () => {
    const config = makeConfig({ method: "get", url: "/x" });
    expect(
      shouldRetryOnNetworkError(
        makeError({ code: "ERR_NETWORK", config }),
        config,
      ),
    ).toBe(true);
  });

  it("GET + ECONNRESET não retentado → retry (Render cold-start spin-down)", () => {
    const config = makeConfig({ method: "get", url: "/x" });
    expect(
      shouldRetryOnNetworkError(
        makeError({ code: "ECONNRESET", config }),
        config,
      ),
    ).toBe(true);
  });

  it("GET default method (undefined) → tratado como get", () => {
    const config = makeConfig({});
    expect(
      shouldRetryOnNetworkError(
        makeError({ code: "ECONNABORTED", config }),
        config,
      ),
    ).toBe(true);
  });

  it("POST + ECONNABORTED → sem retry (não-idempotente)", () => {
    const config = makeConfig({ method: "post", url: "/x" });
    expect(
      shouldRetryOnNetworkError(
        makeError({ code: "ECONNABORTED", config }),
        config,
      ),
    ).toBe(false);
  });

  it("GET + ECONNABORTED + _networkRetried → sem retry (cap 1x)", () => {
    const config = makeConfig({
      method: "get",
      url: "/x",
      _networkRetried: true,
    });
    expect(
      shouldRetryOnNetworkError(
        makeError({ code: "ECONNABORTED", config }),
        config,
      ),
    ).toBe(false);
  });

  it("GET + status 500 (response presente) → sem retry", () => {
    const config = makeConfig({ method: "get", url: "/x" });
    expect(
      shouldRetryOnNetworkError(
        makeError({ code: "ERR_BAD_RESPONSE", status: 500, config }),
        config,
      ),
    ).toBe(false);
  });

  it("GET + outro código de erro → sem retry", () => {
    const config = makeConfig({ method: "get", url: "/x" });
    expect(
      shouldRetryOnNetworkError(makeError({ code: "ERR_CANCELED", config }), config),
    ).toBe(false);
  });

  it("config ausente → sem retry", () => {
    expect(
      shouldRetryOnNetworkError(makeError({ code: "ECONNABORTED" }), undefined),
    ).toBe(false);
  });
});

describe("refreshAccessToken (Sprint 87 singleflight)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("N chamadas paralelas resultam em 1 fetch", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { tokens: { accessToken: "new-access" } } }),
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const [a, b, c] = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken(),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(a).toBe("new-access");
    expect(b).toBe("new-access");
    expect(c).toBe("new-access");
  });

  it("falha compartilhada: todas chamadas recebem null quando refresh 401", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const results = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(results).toEqual([null, null]);
  });

  it("promise é liberada após conclusão: segundo ciclo dispara novo fetch", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { tokens: { accessToken: "t1" } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { tokens: { accessToken: "t2" } } }),
      });
    vi.stubGlobal("fetch", fetchSpy);

    expect(await refreshAccessToken()).toBe("t1");
    expect(await refreshAccessToken()).toBe("t2");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

// Sprint 243c (ADR 0045 · Boss AJUSTE): client axios + fetch refresh
// usam SEMPRE o mesmo host do app (same-origin). NEXT_PUBLIC_API_URL
// (quando setado = https://cesta-gsvc.onrender.com/api/v1) NÃO vaza pro
// client; serve apenas aos fetchers SSR. Prova: axios.defaults.baseURL
// nunca aponta pro host upstream `cesta-gsvc.onrender.com`.
describe("client baseURL same-origin (Sprint 243c ADR 0045)", () => {
  it("CLIENT_API_BASE_URL exportado é /api/v1", () => {
    expect(CLIENT_API_BASE_URL).toBe("/api/v1");
  });

  it("axios instance.defaults.baseURL termina em /api/v1 e NÃO aponta pro upstream cesta-gsvc", () => {
    const baseURL = api.defaults.baseURL ?? "";
    expect(baseURL.endsWith("/api/v1")).toBe(true);
    expect(baseURL).not.toContain("cesta-gsvc.onrender.com");
    expect(baseURL).not.toContain("onrender.com");
  });

  it("refreshAccessToken bate em path same-origin que termina em /api/v1/auth/refresh", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { tokens: { accessToken: "tok" } } }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    await refreshAccessToken();
    // URL DEVE ser same-origin (não upstream onrender). Pode ter origin
    // em jsdom (http://localhost:3000/api/v1/auth/refresh) OU ser
    // puro relativo /api/v1/auth/refresh — ambos same-origin pro browser.
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url.endsWith("/api/v1/auth/refresh")).toBe(true);
    expect(url).not.toContain("cesta-gsvc.onrender.com");
  });
});
