import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils";
import { WizardStepIndicator } from "./wizard-step-indicator";

describe("WizardStepIndicator (Sprint 170)", () => {
  it("renderiza label 'Paso N de M' + progressbar role com aria-valuenow", () => {
    const { getByTestId, getByRole } = renderWithProviders(
      <WizardStepIndicator step={3} total={5} />,
    );
    const label = getByTestId("wizard-step-indicator-label");
    expect(label.textContent).toContain("3");
    expect(label.textContent).toContain("5");
    const bar = getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.getAttribute("aria-valuemin")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("5");
  });

  it("step=1/5 fill width = 20%", () => {
    const { getByTestId } = renderWithProviders(
      <WizardStepIndicator step={1} total={5} />,
    );
    const fill = getByTestId("wizard-step-indicator-fill");
    expect(fill.getAttribute("style")).toContain("width: 20%");
  });

  it("step=5/5 fill width = 100%", () => {
    const { getByTestId } = renderWithProviders(
      <WizardStepIndicator step={5} total={5} />,
    );
    const fill = getByTestId("wizard-step-indicator-fill");
    expect(fill.getAttribute("style")).toContain("width: 100%");
  });

  it("clamp: step > total ainda não excede 100%", () => {
    const { getByTestId } = renderWithProviders(
      <WizardStepIndicator step={10} total={5} />,
    );
    const fill = getByTestId("wizard-step-indicator-fill");
    expect(fill.getAttribute("style")).toContain("width: 100%");
  });
});
