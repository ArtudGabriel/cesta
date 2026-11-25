import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils";
import { ExpensesEmptyState } from "./expenses-empty-state";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/gastos",
}));

describe("ExpensesEmptyState (Sprint 162)", () => {
  it("renderiza title + body + ScanButton", () => {
    const { getByTestId, container } = renderWithProviders(
      <ExpensesEmptyState />,
    );
    expect(getByTestId("expenses-empty-state")).toBeTruthy();
    // ScanButton renderiza algo clicável
    expect(container.querySelector("button, a, input")).toBeTruthy();
  });
});
