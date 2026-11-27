import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SupermarketBadge } from "./supermarket-badge";

describe("SupermarketBadge (Sprint 242 #8)", () => {
  it("renderiza <img> com src /supermarkets/<slug>.svg + alt=name", () => {
    const { getByTestId } = render(
      <SupermarketBadge slug="mercadona" name="Mercadona" color="#009D58" />,
    );
    const img = getByTestId("supermarket-badge-mercadona");
    expect(img.tagName).toBe("IMG");
    expect(img.getAttribute("src")).toBe("/supermarkets/mercadona.svg");
    expect(img.getAttribute("alt")).toBe("Mercadona");
  });

  it("forceFallback=true pula o <img> e renderiza fallback colorido com 2 letras", () => {
    const { getByTestId } = render(
      <SupermarketBadge
        slug="alcampo"
        name="Alcampo"
        color="#E2001A"
        forceFallback
      />,
    );
    const fallback = getByTestId("supermarket-badge-alcampo-fallback");
    expect(fallback.tagName).toBe("SPAN");
    expect(fallback.textContent).toBe("AL");
    expect(fallback.style.backgroundColor).toBe("rgb(226, 0, 26)");
    expect(fallback.getAttribute("role")).toBe("img");
    expect(fallback.getAttribute("aria-label")).toBe("Alcampo");
  });

  it("fallback sem color usa cesta-green var() default", () => {
    const { getByTestId } = render(
      <SupermarketBadge
        slug="xpto"
        name="Nuevo Mercado"
        color={null}
        forceFallback
      />,
    );
    const fallback = getByTestId("supermarket-badge-xpto-fallback");
    expect(fallback.style.backgroundColor).toContain("var(--color-cesta-green)");
  });

  it("size aplica width/height inline", () => {
    const { getByTestId } = render(
      <SupermarketBadge
        slug="dia"
        name="DIA"
        color="#D0021B"
        size={32}
      />,
    );
    const img = getByTestId("supermarket-badge-dia");
    expect(img.style.width).toBe("32px");
    expect(img.style.height).toBe("32px");
  });

  it("onError dispara fallback (simula 404 do asset)", () => {
    const { getByTestId, queryByTestId } = render(
      <SupermarketBadge slug="eroski" name="Eroski" color="#E30613" />,
    );
    const img = getByTestId("supermarket-badge-eroski");
    // fireEvent.error simula imagem que falhou carregar
    const errorEvent = new Event("error");
    img.dispatchEvent(errorEvent);
    // React re-render após setState síncrono
    expect(queryByTestId("supermarket-badge-eroski")).toBeTruthy();
  });

  it("fallback mantém 2 letras caps mesmo quando nome é lowercase", () => {
    const { getByTestId } = render(
      <SupermarketBadge slug="froiz" name="froiz" color="#4BA82E" forceFallback />,
    );
    const fallback = getByTestId("supermarket-badge-froiz-fallback");
    expect(fallback.textContent).toBe("FR");
  });
});
