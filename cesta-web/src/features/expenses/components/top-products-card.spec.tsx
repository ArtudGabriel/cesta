import { describe, expect, it, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import { TopProductsCard } from "./top-products-card";
import { expensesService } from "@/features/expenses/services/expenses.service";
import type { ExpenseTopProduct } from "@/features/expenses/types/expense.types";

vi.mock("@/features/expenses/services/expenses.service", () => ({
  expensesService: {
    topProducts: vi.fn(),
  },
}));

function makeItem(overrides: Partial<ExpenseTopProduct> = {}): ExpenseTopProduct {
  return {
    productId: "p-1",
    name: "Leche entera",
    imageUrl: null,
    total: 4.5,
    quantity: 3,
    ...overrides,
  };
}

describe("TopProductsCard (Sprint 162)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza lista top products quando data > 0", async () => {
    (
      expensesService.topProducts as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      makeItem({ name: "Pan", total: 10, productId: "p-pan" }),
      makeItem({ name: "Leche", total: 5, productId: "p-leche" }),
    ]);
    const { findByTestId, getByText } = renderWithProviders(
      <TopProductsCard period="month" />,
    );
    await findByTestId("top-products-list");
    expect(getByText("Pan")).toBeTruthy();
    expect(getByText("Leche")).toBeTruthy();
  });

  it("renderiza empty state quando array vazio", async () => {
    (
      expensesService.topProducts as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);
    const { findByTestId } = renderWithProviders(
      <TopProductsCard period="month" />,
    );
    await findByTestId("top-products-empty");
  });

  it("renderiza loading skeleton inicial", async () => {
    let resolve!: (v: ExpenseTopProduct[]) => void;
    (expensesService.topProducts as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise<ExpenseTopProduct[]>((r) => {
        resolve = r;
      }),
    );
    const { getByTestId } = renderWithProviders(
      <TopProductsCard period="month" />,
    );
    expect(getByTestId("top-products-loading")).toBeTruthy();
    resolve([]);
    await waitFor(() =>
      expect(() => getByTestId("top-products-loading")).toThrow(),
    );
  });

  it("item sem productId não renderiza Link (apenas div)", async () => {
    (
      expensesService.topProducts as ReturnType<typeof vi.fn>
    ).mockResolvedValue([makeItem({ productId: null, name: "yogur sin match" })]);
    const { findByTestId } = renderWithProviders(
      <TopProductsCard period="month" />,
    );
    const item = await findByTestId("top-product-0");
    // nenhum <a> dentro — item renderiza só div
    expect(item.querySelector("a")).toBeNull();
  });
});
