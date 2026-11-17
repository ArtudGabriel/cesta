import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setAccessToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { server } from "@/mocks/server";
import { renderWithProviders } from "@/test-utils";
import { DsrSection } from "./dsr-section";

const API = "http://localhost:3001/api/v1";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const anchorClick = vi.fn();

beforeEach(() => {
  setAccessToken("mock-access-token");
  useAuthStore.setState({
    user: {
      id: "u1",
      email: "test@cesta.app",
      phone: null,
      name: "Test",
      locale: "es",
      roles: ["user"],
      emailVerifiedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    isHydrated: true,
  });
  toastSuccess.mockClear();
  toastError.mockClear();
  anchorClick.mockClear();

  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    anchorClick();
  });
  if (!("createObjectURL" in URL)) {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: () => "blob:mock",
    });
  }
  if (!("revokeObjectURL" in URL)) {
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: () => undefined,
    });
  }
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DsrSection export (Sprint 91)", () => {
  it("confirm → dispara download + toast success", async () => {
    server.use(
      http.get(`${API}/users/me/export`, () =>
        HttpResponse.arrayBuffer(new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer, {
          status: 200,
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="cesta-datos-u1-2026.zip"',
          },
        }),
      ),
    );

    const { getByRole } = renderWithProviders(<DsrSection />);

    fireEvent.click(getByRole("button", { name: /exportar mis datos/i }));
    fireEvent.click(getByRole("button", { name: /^exportar$/i }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Datos exportados"));
    expect(anchorClick).toHaveBeenCalled();
  });

  it("429 → toast rate limit", async () => {
    server.use(
      http.get(`${API}/users/me/export`, () =>
        HttpResponse.json(
          { code: "RATE_LIMIT", message: "Too many" },
          { status: 429 },
        ),
      ),
    );

    const { getByRole } = renderWithProviders(<DsrSection />);

    fireEvent.click(getByRole("button", { name: /exportar mis datos/i }));
    fireEvent.click(getByRole("button", { name: /^exportar$/i }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Solo puedes exportar una vez por hora. Intenta más tarde.",
      ),
    );
    expect(anchorClick).not.toHaveBeenCalled();
  });
});
