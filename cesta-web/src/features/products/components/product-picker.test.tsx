import { describe, expect, it, vi, beforeEach } from "vitest";
import { useState } from "react";
import { fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import { ProductPicker } from "./product-picker";
import {
  productsService,
  type ProductSearchItem,
} from "@/features/products/services/products.service";

vi.mock("@/features/products/services/products.service", () => ({
  productsService: { search: vi.fn() },
}));

function Harness({ onChange }: { onChange?: (v: ProductSearchItem[]) => void }) {
  const [value, setValue] = useState<ProductSearchItem[]>([]);
  return (
    <ProductPicker
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const CUID = (c: string) => "c" + c.repeat(24);

describe("ProductPicker (Sprint 106)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetch após debounce + render item + pick vira chip", async () => {
    (productsService.search as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [
        {
          id: CUID("a"),
          name: "Leche entera",
          imageUrl: null,
          cheapestUnitPrice: 0.95,
        },
      ],
      total: 1,
    });

    const onChange = vi.fn();
    const { getByTestId } = renderWithProviders(<Harness onChange={onChange} />);
    const input = getByTestId("product-picker-input");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "leche" } });

    await waitFor(() =>
      expect(productsService.search).toHaveBeenCalledWith("leche", 10),
    );
    const result = await waitFor(() =>
      getByTestId(`product-picker-result-${CUID("a")}`),
    );
    fireEvent.mouseDown(result);

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: CUID("a"), name: "Leche entera" }),
    ]);
    await waitFor(() => getByTestId("product-picker-chips"));
  });

  it("query < 2 chars NÃO dispara fetch; wrapper tem data-sentry-mask", async () => {
    const { getByTestId } = renderWithProviders(<Harness />);
    const input = getByTestId("product-picker-input");
    fireEvent.change(input, { target: { value: "a" } });

    // Dá tempo pro debounce teórico expirar sem fetch.
    await new Promise((r) => setTimeout(r, 400));
    expect(productsService.search).not.toHaveBeenCalled();

    expect(getByTestId("product-picker").hasAttribute("data-sentry-mask")).toBe(
      true,
    );
  });
});
