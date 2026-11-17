import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useAuthStore } from "@/stores/auth.store";
import { server } from "@/mocks/server";
import { renderWithProviders } from "@/test-utils";
import { AccountSoftDeletedBanner } from "./account-soft-deleted-banner";

const API = "http://localhost:3001/api/v1";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function buildMeta(daysLeft: number, hoursLeft = 0) {
  const now = Date.now();
  const graceEndsAt = new Date(
    now + daysLeft * 24 * 60 * 60 * 1000 + hoursLeft * 60 * 60 * 1000,
  ).toISOString();
  const deletedAt = new Date(
    new Date(graceEndsAt).getTime() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  return { deletedAt, graceEndsAt };
}

describe("AccountSoftDeletedBanner", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isHydrated: true });
  });

  it("renderiza contador days+hours baseado em graceEndsAt", () => {
    const { getByText } = renderWithProviders(
      <AccountSoftDeletedBanner
        meta={buildMeta(7, 5)}
        payload={{ email: "a@b.com", password: "x" }}
        onDismiss={() => {}}
      />,
    );

    expect(getByText(/7 días/i)).toBeInTheDocument();
    // Tolera jitter de 1h entre `buildMeta` e render (Math.floor em totalHours
    // pode baixar 5 → 4 se microtasks consomem o umbral).
    expect(getByText(/[45] horas/i)).toBeInTheDocument();
  });

  it("dismiss chama callback sem reativar", () => {
    const onDismiss = vi.fn();
    const { getByText } = renderWithProviders(
      <AccountSoftDeletedBanner
        meta={buildMeta(10)}
        payload={{ email: "a@b.com", password: "x" }}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(getByText(/ahora no/i));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("confirm modal dispara reactivate + popula authStore no sucesso", async () => {
    server.use(
      http.post(`${API}/auth/reactivate-account`, async ({ request }) => {
        const body = (await request.json()) as { email: string };
        return HttpResponse.json({
          data: {
            user: {
              id: "u1",
              email: body.email,
              phone: null,
              name: "Reativada",
              locale: "es",
              roles: ["user"],
              emailVerifiedAt: "2026-01-01T00:00:00.000Z",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
            tokens: { accessToken: "new-access", expiresIn: 900 },
          },
          meta: { timestamp: new Date().toISOString() },
        });
      }),
    );

    const { getByText } = renderWithProviders(
      <AccountSoftDeletedBanner
        meta={buildMeta(5)}
        payload={{ email: "a@b.com", password: "right" }}
        onDismiss={() => {}}
      />,
    );

    // Abre modal.
    await act(async () => {
      fireEvent.click(getByText(/reactivar cuenta/i));
    });
    // Confirma dentro do modal.
    await act(async () => {
      fireEvent.click(getByText(/sí, reactivar/i));
    });

    await waitFor(() => {
      expect(useAuthStore.getState().user?.id).toBe("u1");
    });
  });
});
