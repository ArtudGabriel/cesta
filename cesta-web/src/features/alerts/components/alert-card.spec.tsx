import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import { AlertCard } from "./alert-card";
import { alertsService } from "@/features/alerts/services/alerts.service";
import type { Alert } from "@/features/alerts/types/alert.types";

vi.mock("@/features/alerts/services/alerts.service", () => ({
  alertsService: {
    toggle: vi.fn(),
    remove: vi.fn(),
  },
}));

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "a-1",
    productId: "p-1",
    productName: "Leche entera 1L",
    productImageUrl: null,
    supermarketId: null,
    supermarketName: null,
    type: "target_price",
    targetPrice: 1.2,
    isActive: true,
    lastTriggeredAt: null,
    createdAt: new Date().toISOString(),
    triggers: [],
    ...overrides,
  };
}

describe("AlertCard (Sprint 158)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza produto, tipo e market fallback 'Cualquier supermercado'", () => {
    const alert = makeAlert();
    const { getByText, getByTestId } = renderWithProviders(
      <AlertCard alert={alert} />,
    );
    expect(getByText("Leche entera 1L")).toBeTruthy();
    expect(getByText("Cualquier supermercado")).toBeTruthy();
    expect(getByTestId("alert-card-a-1")).toBeTruthy();
  });

  it("não renderiza badge 'Disparada' quando lastTriggeredAt é null", () => {
    const { queryByTestId } = renderWithProviders(
      <AlertCard alert={makeAlert({ lastTriggeredAt: null })} />,
    );
    expect(queryByTestId("alert-badge-triggered-a-1")).toBeNull();
  });

  it("renderiza badge 'Disparada' quando alerta foi disparado e está ativo", () => {
    const { getByTestId } = renderWithProviders(
      <AlertCard
        alert={makeAlert({
          lastTriggeredAt: new Date().toISOString(),
          isActive: true,
        })}
      />,
    );
    expect(getByTestId("alert-badge-triggered-a-1")).toBeTruthy();
  });

  it("toggle inline chama alertsService.toggle com isActive invertido", async () => {
    const toggleMock = alertsService.toggle as ReturnType<typeof vi.fn>;
    toggleMock.mockResolvedValue({});
    const { getByTestId } = renderWithProviders(
      <AlertCard alert={makeAlert({ isActive: true })} />,
    );
    fireEvent.click(getByTestId("alert-toggle-a-1"));
    await waitFor(() => {
      expect(toggleMock).toHaveBeenCalledWith("a-1", false);
    });
  });

  it("delete abre ConfirmDialog antes de remover", () => {
    const removeMock = alertsService.remove as ReturnType<typeof vi.fn>;
    const { getByTestId } = renderWithProviders(
      <AlertCard alert={makeAlert()} />,
    );
    fireEvent.click(getByTestId("alert-delete-a-1"));
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("aplica opacity reduzida quando alert.isActive=false", () => {
    const { getByTestId } = renderWithProviders(
      <AlertCard alert={makeAlert({ isActive: false })} />,
    );
    const card = getByTestId("alert-card-a-1");
    expect(card.className).toMatch(/opacity-60/);
  });
});
