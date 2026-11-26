import { describe, it, expect, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { useAuthStore } from "@/stores/auth.store";
import { setAccessToken } from "@/lib/api";
import { renderHookWithProviders, mockAuthUser } from "@/test-utils";
import { useNutriPreferences } from "./use-nutri-preferences";

function signInMock() {
  setAccessToken("mock-access-token");
  useAuthStore.setState({
    user: mockAuthUser(),

    isHydrated: true,
  });
}

describe("useNutriPreferences", () => {
  beforeEach(() => {
    setAccessToken(null);
    useAuthStore.setState({ user: null, isHydrated: true });
  });

  it("deslogado → defaults false/false", () => {
    const { result } = renderHookWithProviders(() => useNutriPreferences());
    expect(result.current.sortEnabled).toBe(false);
    expect(result.current.healthyOnly).toBe(false);
  });

  it("logado + profile mock nutriHealthyOnly:true → hook retorna healthyOnly:true", async () => {
    signInMock();
    const { result } = renderHookWithProviders(() => useNutriPreferences());
    await waitFor(() => expect(result.current.healthyOnly).toBe(true));
    expect(result.current.sortEnabled).toBe(false);
  });
});
