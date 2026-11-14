import { describe, it, expect, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth.store";
import { setAccessToken } from "@/lib/api";
import { renderHookWithProviders } from "@/test-utils";
import { useProfile } from "./use-profile";

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

describe("useProfile", () => {
  beforeEach(() => {
    signOutMock();
  });

  it("logado + 200 → retorna profile", async () => {
    signInMock();
    const { result } = renderHookWithProviders(() => useProfile());
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.id).toBe("u1");
    expect(result.current.data?.nutriHealthyOnly).toBe(true);
  });

  it("logado + 401 → isError true", async () => {
    signInMock();
    server.use(
      http.get(`${API}/users/me`, () =>
        HttpResponse.json(
          { statusCode: 401, message: "expired" },
          { status: 401 },
        ),
      ),
    );
    const { result } = renderHookWithProviders(() => useProfile());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("deslogado → query disabled, data undefined", () => {
    const { result } = renderHookWithProviders(() => useProfile());
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });
});
