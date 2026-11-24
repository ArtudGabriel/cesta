import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SearchBar } from "./search-bar";

describe("SearchBar", () => {
  it("renderiza placeholder default quando prop omitida", () => {
    const { getByPlaceholderText } = render(
      <SearchBar value="" onChange={() => {}} />,
    );
    expect(getByPlaceholderText("Buscar producto…")).toBeTruthy();
  });

  it("renderiza placeholder custom quando fornecido", () => {
    const { getByPlaceholderText } = render(
      <SearchBar value="" onChange={() => {}} placeholder="Buscar produto…" />,
    );
    expect(getByPlaceholderText("Buscar produto…")).toBeTruthy();
  });

  it("onChange dispara ao digitar", () => {
    const onChange = vi.fn();
    const { getByRole } = render(<SearchBar value="" onChange={onChange} />);
    const input = getByRole("combobox");
    fireEvent.change(input, { target: { value: "leche" } });
    expect(onChange).toHaveBeenCalledWith("leche");
  });

  it("botão limpar aparece quando value não-vazio e dispara onChange('')", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <SearchBar value="leche" onChange={onChange} clearLabel="Clear" />,
    );
    const btn = getByLabelText("Clear");
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("sem value, botão limpar não renderiza", () => {
    const { queryByLabelText } = render(
      <SearchBar value="" onChange={() => {}} clearLabel="Clear" />,
    );
    expect(queryByLabelText("Clear")).toBeNull();
  });

  it("spinner isPending aparece quando prop ativo", () => {
    const { container } = render(
      <SearchBar value="leche" onChange={() => {}} isPending />,
    );
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("role combobox + aria-autocomplete=list preserva a11y", () => {
    const { getByRole } = render(
      <SearchBar value="" onChange={() => {}} ariaExpanded />,
    );
    const input = getByRole("combobox");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(input.getAttribute("aria-expanded")).toBe("true");
  });
});
