import { describe, it, expect, beforeEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth.store";
import { setAccessToken } from "@/lib/api";
import { renderHookWithProviders } from "@/test-utils";
import { useAddFavorite, useFavorites } from "./use-favorites";

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
    refreshToken: "mock-refresh",
    isHydrated: true,
  });
}

describe("useFavorites", () => {
  beforeEach(() => {
    signInMock();
  });

  it("list vazia renderiza", async () => {
    const { result } = renderHookWithProviders(() => useFavorites());
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([]);
  });

  it("list com items renderiza", async () => {
    server.use(
      http.get(`${API}/favorites`, () =>
        HttpResponse.json({
          data: [
            {
              id: "f1",
              productId: "p1",
              createdAt: "2026-01-01T00:00:00.000Z",
              product: null,
              cheapestPrice: null,
            },
          ],
          meta: { timestamp: new Date().toISOString() },
        }),
      ),
    );
    const { result } = renderHookWithProviders(() => useFavorites());
    await waitFor(() => expect(result.current.data?.length).toBe(1));
    expect(result.current.data?.[0].productId).toBe("p1");
  });

  it("useAddFavorite POST fires", async () => {
    let posted = false;
    server.use(
      http.post(`${API}/favorites`, async ({ request }) => {
        posted = true;
        const body = (await request.json()) as { productId: string };
        return HttpResponse.json(
          {
            data: {
              id: "f1",
              productId: body.productId,
              createdAt: new Date().toISOString(),
              product: null,
              cheapestPrice: null,
            },
            meta: { timestamp: new Date().toISOString() },
          },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHookWithProviders(() => useAddFavorite());
    await act(async () => {
      await result.current.mutateAsync("cm000000000000000000000000");
    });
    expect(posted).toBe(true);
  });
});
