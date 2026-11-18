import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils";
import { MetricCard } from "./metric-card";

describe("MetricCard (Sprint 107)", () => {
  it("renderiza label, value e caption opcional", () => {
    const { getByText, queryByText, rerender } = renderWithProviders(
      <MetricCard label="Usuarios totales" value={42} caption="Login reciente" />,
    );
    expect(getByText("Usuarios totales")).toBeTruthy();
    expect(getByText("42")).toBeTruthy();
    expect(getByText("Login reciente")).toBeTruthy();

    rerender(<MetricCard label="Alertas" value="7" />);
    expect(getByText("Alertas")).toBeTruthy();
    expect(getByText("7")).toBeTruthy();
    expect(queryByText("Login reciente")).toBeNull();
  });
});
