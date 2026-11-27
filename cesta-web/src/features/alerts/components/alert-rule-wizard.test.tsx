import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import { AlertRuleWizard } from "./alert-rule-wizard";
import { alertsService } from "@/features/alerts/services/alerts.service";
import { productsService } from "@/features/products/services/products.service";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/features/alerts/services/alerts.service", () => ({
  alertsService: {
    createCombo: vi.fn(),
    createTrend: vi.fn(),
    createBundle: vi.fn(),
  },
}));

vi.mock("@/features/products/services/products.service", () => ({
  productsService: {
    search: vi.fn(),
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

const VALID_CUID_1 = "c" + "a".repeat(24);
const VALID_CUID_2 = "c" + "b".repeat(24);

async function pickTwoProducts(getByTestId: (id: string) => HTMLElement) {
  (productsService.search as ReturnType<typeof vi.fn>).mockResolvedValue({
    items: [
      { id: VALID_CUID_1, name: "Leche entera", imageUrl: null, cheapestUnitPrice: 0.95 },
      { id: VALID_CUID_2, name: "Leche desnatada", imageUrl: null, cheapestUnitPrice: 1.1 },
    ],
    total: 2,
  });
  const input = getByTestId("product-picker-input") as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "leche" } });
  await waitFor(() => getByTestId(`product-picker-result-${VALID_CUID_1}`));
  fireEvent.mouseDown(getByTestId(`product-picker-result-${VALID_CUID_1}`));
  // Após pick, picker limpa a query (UX). Re-digita pra selecionar o segundo.
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "leche" } });
  await waitFor(() => getByTestId(`product-picker-result-${VALID_CUID_2}`));
  fireEvent.mouseDown(getByTestId(`product-picker-result-${VALID_CUID_2}`));
}

describe("AlertRuleWizard (Sprint 105)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toastSuccess.mockClear();
    toastError.mockClear();
    sentryCapture.mockClear();
    // jsdom não implementa scrollIntoView; validate() dispara rAF que
    // chama scrollIntoView no erro inline (uncaught exception quebra teste).
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("step 1: lista os 3 tipos; clicar em combo avança pra form", () => {
    const { getByTestId } = renderWithProviders(<AlertRuleWizard />);
    expect(getByTestId("rule-wizard-type-picker")).toBeTruthy();
    expect(getByTestId("rule-type-combo")).toBeTruthy();
    expect(getByTestId("rule-type-trend")).toBeTruthy();
    expect(getByTestId("rule-type-bundle")).toBeTruthy();

    fireEvent.click(getByTestId("rule-type-combo"));
    expect(getByTestId("rule-wizard-form")).toBeTruthy();
  });

  // ────────────────────────────────────────────────────────────
  // Sprint 228 #17 — trend como default (1 produto · queda %)
  // ────────────────────────────────────────────────────────────

  it("S228 #17: Tendência de bajada aparece PRIMEIRO no type picker (default 1 produto)", () => {
    const { container } = renderWithProviders(<AlertRuleWizard />);
    const buttons = Array.from(
      container.querySelectorAll("[data-testid^='rule-type-']"),
    );
    expect(buttons[0].getAttribute("data-testid")).toBe("rule-type-trend");
    expect(buttons[1].getAttribute("data-testid")).toBe("rule-type-combo");
    expect(buttons[2].getAttribute("data-testid")).toBe("rule-type-bundle");
  });

  it("S228 #17: combo targetTotal placeholder é 0.00 (não 10.00)", () => {
    const { getByTestId } = renderWithProviders(<AlertRuleWizard />);
    fireEvent.click(getByTestId("rule-type-combo"));
    const input = getByTestId("rule-input-target-total") as HTMLInputElement;
    expect(input.placeholder).toBe("0.00");
  });

  it("S228 #17: bundle targetSavings placeholder é 0.00 (não 5.00)", () => {
    const { getByTestId } = renderWithProviders(<AlertRuleWizard />);
    fireEvent.click(getByTestId("rule-type-bundle"));
    const input = getByTestId("rule-input-target-savings") as HTMLInputElement;
    expect(input.placeholder).toBe("0.00");
  });

  it("S228 #17: combo sem produtos → erro guia user pra Tendência", async () => {
    const { getByTestId, container } = renderWithProviders(<AlertRuleWizard />);
    fireEvent.click(getByTestId("rule-type-combo"));
    fireEvent.change(getByTestId("rule-input-target-total"), {
      target: { value: "10.50" },
    });
    fireEvent.click(getByTestId("rule-submit"));

    await waitFor(() => {
      expect(container.textContent).toMatch(/Tendencia|Tendência/);
    });
    expect(alertsService.createCombo).not.toHaveBeenCalled();
  });

  it("combo: submit válido chama createCombo e navega pra /alertas", async () => {
    (alertsService.createCombo as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "r-1",
    });
    const { getByTestId } = renderWithProviders(<AlertRuleWizard />);
    fireEvent.click(getByTestId("rule-type-combo"));

    await pickTwoProducts(getByTestId);
    fireEvent.change(getByTestId("rule-input-target-total"), {
      target: { value: "10.50" },
    });
    fireEvent.click(getByTestId("rule-submit"));

    await waitFor(() => {
      expect(alertsService.createCombo).toHaveBeenCalledWith({
        productIds: [VALID_CUID_1, VALID_CUID_2],
        targetTotal: 10.5,
      });
      expect(pushMock).toHaveBeenCalledWith("/alertas");
    });
  });

  it("GDPR: form tem data-sentry-mask no wrapper", () => {
    const { getByTestId } = renderWithProviders(<AlertRuleWizard />);
    fireEvent.click(getByTestId("rule-type-combo"));
    const form = getByTestId("rule-wizard-form");
    expect(form.hasAttribute("data-sentry-mask")).toBe(true);
  });

  it("trend: submit válido chama createTrend e navega pra /alertas", async () => {
    (alertsService.createTrend as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "r-trend",
    });
    const { getByTestId } = renderWithProviders(<AlertRuleWizard />);
    fireEvent.click(getByTestId("rule-type-trend"));

    fireEvent.change(getByTestId("rule-input-product-ids"), {
      target: { value: VALID_CUID_1 },
    });
    fireEvent.change(getByTestId("rule-input-weeks"), {
      target: { value: "3" },
    });
    fireEvent.click(getByTestId("rule-submit"));

    await waitFor(() => {
      expect(alertsService.createTrend).toHaveBeenCalledWith({
        productId: VALID_CUID_1,
        consecutiveWeeks: 3,
      });
      expect(pushMock).toHaveBeenCalledWith("/alertas");
    });
  });

  it("trend: weeks fora da faixa 2..12 → erro inline, não chama service", async () => {
    const { getByTestId, container } = renderWithProviders(<AlertRuleWizard />);
    fireEvent.click(getByTestId("rule-type-trend"));

    fireEvent.change(getByTestId("rule-input-product-ids"), {
      target: { value: VALID_CUID_1 },
    });
    fireEvent.change(getByTestId("rule-input-weeks"), {
      target: { value: "13" },
    });
    fireEvent.click(getByTestId("rule-submit"));

    await waitFor(() => {
      expect(container.textContent).toMatch(/2.*12/);
    });
    expect(alertsService.createTrend).not.toHaveBeenCalled();
  });

  it("bundle: submit válido chama createBundle e navega pra /alertas", async () => {
    (alertsService.createBundle as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "r-bundle",
    });
    const { getByTestId } = renderWithProviders(<AlertRuleWizard />);
    fireEvent.click(getByTestId("rule-type-bundle"));

    await pickTwoProducts(getByTestId);
    fireEvent.change(getByTestId("rule-input-target-savings"), {
      target: { value: "3.00" },
    });
    fireEvent.click(getByTestId("rule-submit"));

    await waitFor(() => {
      expect(alertsService.createBundle).toHaveBeenCalledWith({
        productIds: [VALID_CUID_1, VALID_CUID_2],
        targetSavings: 3,
      });
      expect(pushMock).toHaveBeenCalledWith("/alertas");
    });
  });

  it("combo: menos de 2 productIds → erro inline, não chama service", async () => {
    // Nenhum produto selecionado via ProductPicker → validate() bloqueia submit.
    const { getByTestId, container } = renderWithProviders(<AlertRuleWizard />);
    fireEvent.click(getByTestId("rule-type-combo"));

    fireEvent.change(getByTestId("rule-input-target-total"), {
      target: { value: "10.50" },
    });
    fireEvent.click(getByTestId("rule-submit"));

    await waitFor(() => {
      expect(container.textContent).toMatch(/2\+? productos|2\+? produtos/i);
    });
    expect(alertsService.createCombo).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────
  // Sprint 159 — silent fail fix
  // ────────────────────────────────────────────────────────────

  it("combo: submit success dispara toast.success e router.push", async () => {
    (alertsService.createCombo as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "r-combo",
    });
    const { getByTestId } = renderWithProviders(<AlertRuleWizard />);
    fireEvent.click(getByTestId("rule-type-combo"));

    await pickTwoProducts(getByTestId);
    fireEvent.change(getByTestId("rule-input-target-total"), {
      target: { value: "10.00" },
    });
    fireEvent.click(getByTestId("rule-submit"));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/alertas");
    });
  });

  it("combo: submit error → toast.error + Sentry capture + FieldError inline visible", async () => {
    (alertsService.createCombo as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Boom backend"),
    );
    const { getByTestId, container } = renderWithProviders(<AlertRuleWizard />);
    fireEvent.click(getByTestId("rule-type-combo"));

    await pickTwoProducts(getByTestId);
    fireEvent.change(getByTestId("rule-input-target-total"), {
      target: { value: "10.00" },
    });
    fireEvent.click(getByTestId("rule-submit"));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
      expect(sentryCapture).toHaveBeenCalled();
    });
    // FieldError inline presente no container (role=alert).
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    // Router NÃO redirecionou em caso de erro.
    expect(pushMock).not.toHaveBeenCalledWith("/alertas");
  });
});
