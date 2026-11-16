import { describe, it, expect } from "vitest";
import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import { shouldRetryOnNetworkError } from "./api";

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
