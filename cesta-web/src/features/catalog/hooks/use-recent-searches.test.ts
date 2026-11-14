import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth.store";
import { setAccessToken } from "@/lib/api";
import { renderHookWithProviders } from "@/test-utils";
import { useRecentSearches } from "./use-recent-searches";

const API = "http://localhost:3001/api/v1";

function signInMock() {
  setAccessToken("mock-access-token");
  useAuthStore.setState({
    user: {
      id: "u1",
      email: "test@cesta.app",
      phone: null,
      name: "Test",
      locale: "es",
      roles: ["user"],
      createdAt: "2026-01-01T00:00:00.000Z",
    },

    isHydrated: true,
  });
}

function signOutMock() {
  setAccessToken(null);
  useAuthStore.setState({ user: null, isHydrated: true });
}

describe("useRecentSearches", () => {
  beforeEach(() => {
    window.localStorage.clear();
    signOutMock();
  });

  it("add novo entra no front", () => {
    const { result } = renderHookWithProviders(() => useRecentSearches());
    act(() => {
      result.current.add("aceite");
    });
    expect(result.current.recents).toEqual(["aceite"]);
    act(() => {
      result.current.add("arroz");
    });
    expect(result.current.recents).toEqual(["arroz", "aceite"]);
  });

  it("add duplicado move pro front sem duplicar", () => {
    const { result } = renderHookWithProviders(() => useRecentSearches());
    act(() => {
      result.current.add("aceite");
      result.current.add("arroz");
      result.current.add("aceite");
    });
    expect(result.current.recents).toEqual(["aceite", "arroz"]);
  });

  it("add 11o remove o mais antigo (max 10)", () => {
    const { result } = renderHookWithProviders(() => useRecentSearches());
    act(() => {
      for (let i = 0; i < 11; i++) result.current.add(`query${i.toString().padStart(2, "0")}`);
    });
    expect(result.current.recents).toHaveLength(10);
    expect(result.current.recents[0]).toBe("query10");
    expect(result.current.recents.includes("query00")).toBe(false);
  });

  it("query < 2 chars nao entra", () => {
    const { result } = renderHookWithProviders(() => useRecentSearches());
    act(() => {
      result.current.add("a");
      result.current.add("");
      result.current.add("  ");
    });
    expect(result.current.recents).toEqual([]);
  });

  it("remove tira item especifico", () => {
    const { result } = renderHookWithProviders(() => useRecentSearches());
    act(() => {
      result.current.add("aceite");
      result.current.add("arroz");
    });
    act(() => {
      result.current.remove("aceite");
    });
    expect(result.current.recents).toEqual(["arroz"]);
  });

  it("clear esvazia tudo", () => {
    const { result } = renderHookWithProviders(() => useRecentSearches());
    act(() => {
      result.current.add("aceite");
      result.current.add("arroz");
      result.current.clear();
    });
    expect(result.current.recents).toEqual([]);
  });
});

describe("useRecentSearches — backend path (logado)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    signInMock();
  });

  afterEach(() => {
    signOutMock();
  });

  it("GET /search-history → recents populados do backend", async () => {
    const { result } = renderHookWithProviders(() => useRecentSearches());
    await waitFor(() => expect(result.current.recents.length).toBe(1));
    expect(result.current.recents[0]).toBe("aceite");
  });

  it("add → POST dispara + lista atualiza pos-invalidate", async () => {
    let posted = "";
    const items = [
      { id: "h1", query: "aceite", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    server.use(
      http.get(`${API}/search-history`, () =>
        HttpResponse.json({
          data: { history: items.slice() },
          meta: { timestamp: new Date().toISOString() },
        }),
      ),
      http.post(`${API}/search-history`, async ({ request }) => {
        const body = (await request.json()) as { query: string };
        posted = body.query;
        const created = {
          id: `h-${body.query}`,
          query: body.query,
          createdAt: new Date().toISOString(),
        };
        items.unshift(created);
        return HttpResponse.json(
          {
            data: created,
            meta: { timestamp: new Date().toISOString() },
          },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHookWithProviders(() => useRecentSearches());
    await waitFor(() => expect(result.current.recents.length).toBe(1));

    act(() => {
      result.current.add("arroz");
    });

    await waitFor(() => expect(posted).toBe("arroz"));
    await waitFor(() => expect(result.current.recents[0]).toBe("arroz"));
  });

  it("add query < 2 chars → não dispara POST", async () => {
    let posted = false;
    server.use(
      http.post(`${API}/search-history`, () => {
        posted = true;
        return HttpResponse.json(
          {
            data: { id: "x", query: "x", createdAt: new Date().toISOString() },
            meta: { timestamp: new Date().toISOString() },
          },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHookWithProviders(() => useRecentSearches());
    await waitFor(() => expect(result.current.recents.length).toBe(1));

    act(() => {
      result.current.add("a");
      result.current.add("");
    });

    expect(posted).toBe(false);
  });

  it("remove → DELETE dispara + lista limpa pos-invalidate", async () => {
    let deletedPath = "";
    let hasItems = true;
    server.use(
      http.get(`${API}/search-history`, () =>
        HttpResponse.json({
          data: {
            history: hasItems
              ? [{ id: "h1", query: "aceite", createdAt: "2026-01-01T00:00:00.000Z" }]
              : [],
          },
          meta: { timestamp: new Date().toISOString() },
        }),
      ),
      http.delete(`${API}/search-history/:q`, ({ params }) => {
        deletedPath = decodeURIComponent(params.q as string);
        hasItems = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHookWithProviders(() => useRecentSearches());
    await waitFor(() => expect(result.current.recents.length).toBe(1));

    act(() => {
      result.current.remove("aceite");
    });

    await waitFor(() => expect(deletedPath).toBe("aceite"));
    await waitFor(() => expect(result.current.recents).toEqual([]));
  });

  it("clear → DELETE /search-history + lista vazia pos-invalidate", async () => {
    let cleared = false;
    let hasItems = true;
    server.use(
      http.get(`${API}/search-history`, () =>
        HttpResponse.json({
          data: {
            history: hasItems
              ? [{ id: "h1", query: "aceite", createdAt: "2026-01-01T00:00:00.000Z" }]
              : [],
          },
          meta: { timestamp: new Date().toISOString() },
        }),
      ),
      http.delete(`${API}/search-history`, () => {
        cleared = true;
        hasItems = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHookWithProviders(() => useRecentSearches());
    await waitFor(() => expect(result.current.recents.length).toBe(1));

    act(() => {
      result.current.clear();
    });

    await waitFor(() => expect(cleared).toBe(true));
    await waitFor(() => expect(result.current.recents).toEqual([]));
  });
});
