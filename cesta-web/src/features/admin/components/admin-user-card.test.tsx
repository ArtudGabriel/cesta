import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setAccessToken } from "@/lib/api";
import { server } from "@/mocks/server";
import { renderWithProviders } from "@/test-utils";
import { AdminUserCard } from "./admin-user-card";

const API = "http://localhost:3001/api/v1";

const routerRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh, push: vi.fn(), replace: vi.fn() }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const user = {
  id: "u-soft-1",
  email: "soft@example.com",
  deletedAt: "2026-11-15T10:00:00.000Z",
  graceEndsAt: "2026-12-15T10:00:00.000Z",
};

beforeEach(() => {
  setAccessToken("mock-access-token");
  toastSuccess.mockClear();
  toastError.mockClear();
  routerRefresh.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AdminUserCard (Sprint 95)", () => {
  it("confirm cancel → POST reactivated → toast success + router.refresh", async () => {
    server.use(
      http.post(`${API}/admin/users/u-soft-1/cancel-delete`, () =>
        HttpResponse.json({
          data: {
            status: "reactivated",
            user: { id: "u-soft-1", email: "soft@example.com" },
          },
          meta: { timestamp: new Date().toISOString() },
        }),
      ),
    );

    const { getByRole } = renderWithProviders(<AdminUserCard user={user} />);

    fireEvent.click(getByRole("button", { name: /cancelar eliminación/i }));
    fireEvent.click(getByRole("button", { name: /^reactivar$/i }));

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Cuenta reactivada."),
    );
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("POST falha → toast error, sem refresh", async () => {
    server.use(
      http.post(`${API}/admin/users/u-soft-1/cancel-delete`, () =>
        HttpResponse.json(
          { message: "Boom", errorCode: "ADMIN.BOOM" },
          { status: 500 },
        ),
      ),
    );

    const { getByRole } = renderWithProviders(<AdminUserCard user={user} />);

    fireEvent.click(getByRole("button", { name: /cancelar eliminación/i }));
    fireEvent.click(getByRole("button", { name: /^reactivar$/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});
