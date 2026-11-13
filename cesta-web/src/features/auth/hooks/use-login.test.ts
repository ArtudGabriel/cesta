import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { useAuthStore } from "@/stores/auth.store";
import { renderHookWithProviders } from "@/test-utils";
import { useLogin } from "./use-auth";

// next/navigation não existe em jsdom — mock router.push + searchParams.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

describe("useLogin", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, refreshToken: null, isHydrated: true });
  });

  it("login OK → setSession chamado + user populado", async () => {
    const { result } = renderHookWithProviders(() => useLogin());

    await act(async () => {
      await result.current.mutateAsync({
        email: "test@cesta.app",
        password: "right",
      });
    });

    const state = useAuthStore.getState();
    expect(state.user?.email).toBe("test@cesta.app");
    expect(state.refreshToken).toBe("mock-refresh-token");
  });

  it("login senha errada → user null + rejeita", async () => {
    const { result } = renderHookWithProviders(() => useLogin());

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({
          email: "test@cesta.app",
          password: "wrong",
        });
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    await waitFor(() => expect(result.current.isError).toBe(true));
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
  });
});
