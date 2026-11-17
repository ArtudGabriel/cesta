import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "@/test-utils";
import { pushService } from "../services/alerts.service";
import { usePush } from "./use-push";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../services/alerts.service", () => ({
  pushService: {
    getVapidKey: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

const mockedPush = pushService as unknown as {
  getVapidKey: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
};

/**
 * Sprint 96: hook usePush — fluxo activate chama POST /users/me/push-subscription
 * (via pushService.subscribe) e persiste id em localStorage; deactivate manda
 * DELETE :id com o id salvo.
 */
describe("usePush", () => {
  const originalWindow = window;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "default",
        requestPermission: vi.fn().mockResolvedValue("granted"),
      },
    });

    const fakeSub = {
      endpoint: "https://push.example/sub1",
      toJSON: () => ({
        endpoint: "https://push.example/sub1",
        keys: { p256dh: "p256", auth: "auth" },
      }),
      unsubscribe: vi.fn().mockResolvedValue(true),
    };
    const fakeRegistration = {
      pushManager: {
        subscribe: vi.fn().mockResolvedValue(fakeSub),
        getSubscription: vi.fn().mockResolvedValue(fakeSub),
      },
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: vi.fn().mockResolvedValue(fakeRegistration),
        ready: Promise.resolve(fakeRegistration),
        getRegistration: vi.fn().mockResolvedValue(fakeRegistration),
      },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManager() {},
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: originalWindow.Notification,
    });
  });

  it("enable: pede permissão, assina backend e persiste id em localStorage", async () => {
    mockedPush.getVapidKey.mockResolvedValue(
      // chave de exemplo (base64url) — 65 bytes padded não importa pro mock atob
      "BMqLjPJ7N4V0xjvN7yfiIv87eQM0GHHVGqe3wG6jQQrxkF3n0gq2mAcV1QYwoi",
    );
    mockedPush.subscribe.mockResolvedValue({
      id: "ps-xyz",
      endpoint: "https://push.example/sub1",
    });

    const { result } = renderHookWithProviders(() => usePush());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.enable();
    });

    expect(mockedPush.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://push.example/sub1",
        keys: { p256dh: "p256", auth: "auth" },
      }),
    );
    expect(window.localStorage.getItem("cesta:push-subscription-id")).toBe(
      "ps-xyz",
    );
    expect(result.current.subscribed).toBe(true);
  });

  it("disable: manda DELETE com o id salvo e limpa localStorage", async () => {
    window.localStorage.setItem("cesta:push-subscription-id", "ps-xyz");
    mockedPush.unsubscribe.mockResolvedValue(undefined);

    const { result } = renderHookWithProviders(() => usePush());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.disable();
    });

    expect(mockedPush.unsubscribe).toHaveBeenCalledWith("ps-xyz");
    expect(window.localStorage.getItem("cesta:push-subscription-id")).toBeNull();
    expect(result.current.subscribed).toBe(false);
  });
});
