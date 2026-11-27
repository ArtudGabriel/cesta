import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import { ProductImage } from "./product-image";

describe("ProductImage (Sprint 227 #3 fallback)", () => {
  it("renderiza fallback quando src null", () => {
    const { getByRole } = renderWithProviders(
      <ProductImage src={null} alt="Prod X" width={64} height={64} />,
    );
    expect(getByRole("img").getAttribute("aria-label")).toBe("Sin foto");
  });

  it("renderiza fallback quando src vazia", () => {
    const { getByRole } = renderWithProviders(
      <ProductImage src="" alt="Prod X" width={64} height={64} />,
    );
    expect(getByRole("img").getAttribute("aria-label")).toBe("Sin foto");
  });

  it("renderiza Image quando src valido", () => {
    const { getByAltText, queryByRole } = renderWithProviders(
      <ProductImage
        src="https://pub.r2.dev/products/abc.jpg"
        alt="Prod X"
        width={64}
        height={64}
      />,
    );
    expect(getByAltText("Prod X")).toBeTruthy();
    // aria-label='Sin foto' nao aparece porque Image renderizou
    expect(
      queryByRole("img", { name: "Sin foto" }),
    ).toBeNull();
  });

  it("swap pra fallback quando Image onError dispara", () => {
    const { getByAltText, getByRole } = renderWithProviders(
      <ProductImage
        src="https://broken.example/x.jpg"
        alt="Prod X"
        width={64}
        height={64}
      />,
    );
    const img = getByAltText("Prod X") as HTMLImageElement;
    fireEvent.error(img);
    expect(getByRole("img").getAttribute("aria-label")).toBe("Sin foto");
  });

  it("showLabel=false omite texto mas mantem icone acessivel", () => {
    const { getByRole, queryByText } = renderWithProviders(
      <ProductImage
        src={null}
        alt="Prod X"
        width={64}
        height={64}
        showLabel={false}
      />,
    );
    expect(getByRole("img").getAttribute("aria-label")).toBe("Sin foto");
    expect(queryByText("Sin foto")).toBeNull();
  });
});
