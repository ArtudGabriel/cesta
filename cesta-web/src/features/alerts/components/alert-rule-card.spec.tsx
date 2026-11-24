import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import { AlertRuleCard } from "./alert-rule-card";
import { alertsService } from "@/features/alerts/services/alerts.service";
import type { AlertRule } from "@/features/alerts/types/alert.types";

vi.mock("@/features/alerts/services/alerts.service", () => ({
  alertsService: {
    toggleRule: vi.fn(),
    removeRule: vi.fn(),
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const sentryCapture = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => sentryCapture(...args),
}));

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: "r-1",
    type: "combo",
    isActive: true,
    rules: { productIds: ["p-1", "p-2"], targetTotal: 10 },
    lastTriggeredAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("AlertRuleCard (Sprint 160)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toastSuccess.mockClear();
    toastError.mockClear();
    sentryCapture.mockClear();
  });

  it("renderiza type label + summary + actions inline", () => {
    const { getByTestId } = renderWithProviders(
      <AlertRuleCard rule={makeRule()} />,
    );
    expect(getByTestId("alert-rule-card-r-1")).toBeTruthy();
    expect(getByTestId("alert-rule-toggle-r-1")).toBeTruthy();
    expect(getByTestId("alert-rule-delete-r-1")).toBeTruthy();
  });

  it("toggle: click chama alertsService.toggleRule com isActive invertido", async () => {
    (alertsService.toggleRule as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...makeRule(),
      isActive: false,
    });
    const { getByTestId } = renderWithProviders(
      <AlertRuleCard rule={makeRule({ isActive: true })} />,
    );
    fireEvent.click(getByTestId("alert-rule-toggle-r-1"));
    await waitFor(() => {
      expect(alertsService.toggleRule).toHaveBeenCalledWith("r-1", false);
    });
  });

  it("toggle: erro backend → toast.error + Sentry capture", async () => {
    (alertsService.toggleRule as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Boom"),
    );
    const { getByTestId } = renderWithProviders(
      <AlertRuleCard rule={makeRule({ isActive: true })} />,
    );
    fireEvent.click(getByTestId("alert-rule-toggle-r-1"));
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
      expect(sentryCapture).toHaveBeenCalled();
    });
  });

  it("delete: abre ConfirmDialog antes de remover (não chama remove direto)", () => {
    const removeMock = alertsService.removeRule as ReturnType<typeof vi.fn>;
    const { getByTestId } = renderWithProviders(
      <AlertRuleCard rule={makeRule()} />,
    );
    fireEvent.click(getByTestId("alert-rule-delete-r-1"));
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("opacity reduzida quando rule.isActive=false", () => {
    const { getByTestId } = renderWithProviders(
      <AlertRuleCard rule={makeRule({ isActive: false })} />,
    );
    const card = getByTestId("alert-rule-card-r-1");
    expect(card.className).toMatch(/opacity-60/);
  });
});
