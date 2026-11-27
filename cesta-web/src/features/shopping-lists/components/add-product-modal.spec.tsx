import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import { AddProductModal } from "./add-product-modal";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

const addMutate = vi.fn();
vi.mock("../hooks/use-shopping-lists", () => ({
  useAddItem: () => ({ mutate: addMutate, isPending: false }),
}));

const useProductsMock = vi.fn();
vi.mock("@/features/catalog/hooks/use-catalog", () => ({
  useProducts: (opts: unknown) => useProductsMock(opts),
}));

function fakeProduct(
  id: string,
  name: string,
  imageUrl: string | null,
  cheapestPrice: number | null = 1.25,
) {
  return {
    id,
    name,
    brand: null,
    imageUrl,
    categoryId: null,
    packageSize: 1,
    packageUnit: "LITER",
    comparisonUnit: "LITER",
    calories: null,
    protein: null,
    fat: null,
    saturatedFat: null,
    carbs: null,
    sugar: null,
    salt: null,
    fiber: null,
    nutritionPer: null,
    nutriScore: null,
    isVegan: false,
    isVegetarian: false,
    isGlutenFree: false,
    isLactoseFree: false,
    prices: [],
    cheapestSupermarketSlug: null,
    cheapestPrice,
    cheapestUnitPrice: null,
    isStale: false,
  };
}

describe("AddProductModal (Sprint 238 #3 fotos + #4 tap-detalhe)", () => {
  beforeEach(() => {
    routerPush.mockReset();
    addMutate.mockReset();
    useProductsMock.mockReset();
  });

  it("S238 #3: produto com imageUrl renderiza Image (fallback só quando null)", () => {
    useProductsMock.mockReturnValue({
      data: {
        items: [fakeProduct("p1", "Leche entera 1L", "https://cdn/l.jpg")],
      },
      isLoading: false,
    });
    const { container } = renderWithProviders(
      <AddProductModal listId="list-1" open={true} onClose={vi.fn()} />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    // next/image reescreve o src como URL do /_next/image?url=...; só precisamos
    // confirmar que o path do produto apareceu codificado no src final.
    expect(img?.getAttribute("src")).toContain(encodeURIComponent("https://cdn/l.jpg"));
  });

  it("S238 #3: imageUrl null renderiza ProductImage fallback (role=img + aria-label)", () => {
    useProductsMock.mockReturnValue({
      data: { items: [fakeProduct("p2", "Producto sin foto", null)] },
      isLoading: false,
    });
    const { getAllByRole, container } = renderWithProviders(
      <AddProductModal listId="list-1" open={true} onClose={vi.fn()} />,
    );
    // Fallback usa <div role="img" aria-label="Sin foto"> em vez de <img>.
    const imgs = getAllByRole("img");
    expect(imgs.length).toBeGreaterThan(0);
    expect(container.querySelector("img")).toBeNull();
  });

  it("S238 #4: tap/click no card chama onClose e empurra /produto/:id", () => {
    useProductsMock.mockReturnValue({
      data: { items: [fakeProduct("p3", "Pan integral 500g", null)] },
      isLoading: false,
    });
    const onClose = vi.fn();
    const { getByTestId } = renderWithProviders(
      <AddProductModal listId="list-1" open={true} onClose={onClose} />,
    );
    const row = getByTestId("add-product-result");
    const mainBtn = row.querySelector('button[aria-label^="Ver detalle"]');
    expect(mainBtn).not.toBeNull();
    fireEvent.click(mainBtn as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith("/produto/p3");
    expect(addMutate).not.toHaveBeenCalled();
  });

  it("S238 #4: botão Add fica separado — clicar NÃO abre detalhe", () => {
    useProductsMock.mockReturnValue({
      data: { items: [fakeProduct("p4", "Yogur natural", null)] },
      isLoading: false,
    });
    const onClose = vi.fn();
    const { getByTestId } = renderWithProviders(
      <AddProductModal listId="list-1" open={true} onClose={onClose} />,
    );
    const addBtn = getByTestId("add-product-add-btn");
    fireEvent.click(addBtn);
    expect(addMutate).toHaveBeenCalledWith({ productId: "p4", quantity: 1 });
    expect(routerPush).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("open=false não renderiza nada", () => {
    useProductsMock.mockReturnValue({ data: { items: [] }, isLoading: false });
    const { container } = renderWithProviders(
      <AddProductModal listId="list-1" open={false} onClose={vi.fn()} />,
    );
    expect(container.textContent).toBe("");
  });
});
