import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useRecentSearches } from "./use-recent-searches";

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useRecentSearches", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("add novo entra no front", () => {
    const { result } = renderHook(() => useRecentSearches(), {
      wrapper: createWrapper(),
    });
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
    const { result } = renderHook(() => useRecentSearches(), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.add("aceite");
      result.current.add("arroz");
      result.current.add("aceite");
    });
    expect(result.current.recents).toEqual(["aceite", "arroz"]);
  });

  it("add 11o remove o mais antigo (max 10)", () => {
    const { result } = renderHook(() => useRecentSearches(), {
      wrapper: createWrapper(),
    });
    act(() => {
      for (let i = 0; i < 11; i++) result.current.add(`query${i.toString().padStart(2, "0")}`);
    });
    expect(result.current.recents).toHaveLength(10);
    expect(result.current.recents[0]).toBe("query10");
    expect(result.current.recents.includes("query00")).toBe(false);
  });

  it("query < 2 chars nao entra", () => {
    const { result } = renderHook(() => useRecentSearches(), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.add("a");
      result.current.add("");
      result.current.add("  ");
    });
    expect(result.current.recents).toEqual([]);
  });

  it("remove tira item especifico", () => {
    const { result } = renderHook(() => useRecentSearches(), {
      wrapper: createWrapper(),
    });
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
    const { result } = renderHook(() => useRecentSearches(), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.add("aceite");
      result.current.add("arroz");
      result.current.clear();
    });
    expect(result.current.recents).toEqual([]);
  });
});
