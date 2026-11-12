import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { HighlightedText } from "./highlighted-text";

describe("HighlightedText", () => {
  it("renderiza text cru quando highlight vazio", () => {
    const { container } = render(<HighlightedText text="Aceite de oliva" />);
    expect(container.textContent).toBe("Aceite de oliva");
    expect(container.querySelector("mark")).toBeNull();
  });

  it("marca trecho matching case-insensitive", () => {
    const { container } = render(
      <HighlightedText text="Aceite de oliva" highlight="aceite" />,
    );
    const mark = container.querySelector("mark");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("Aceite");
    expect(container.textContent).toBe("Aceite de oliva");
  });

  it("regex chars em highlight nao quebram componente", () => {
    const { container } = render(
      <HighlightedText text="Arroz (500g)" highlight="arroz (500g)" />,
    );
    const mark = container.querySelector("mark");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("Arroz (500g)");
    expect(container.textContent).toBe("Arroz (500g)");
  });

  it("highlight sem match -> sem mark, texto preservado", () => {
    const { container } = render(
      <HighlightedText text="Aceite" highlight="xyzzz" />,
    );
    expect(container.querySelector("mark")).toBeNull();
    expect(container.textContent).toBe("Aceite");
  });
});
