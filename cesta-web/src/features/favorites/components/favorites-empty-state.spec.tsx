import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import {
  FavoritesEmptyState,
  FavoritesFilteredEmptyState,
} from "./favorites-empty-state";

describe("FavoritesEmptyState (Sprint 164)", () => {
  it("renderiza title + body + CTA explore com href /", () => {
    const { getByTestId } = renderWithProviders(<FavoritesEmptyState />);
    expect(getByTestId("favorites-empty-state")).toBeTruthy();
    const cta = getByTestId("favorites-empty-cta");
    expect(cta.getAttribute("href")).toBe("/");
  });
});

describe("FavoritesFilteredEmptyState (Sprint 164)", () => {
  it("renderiza title + clear CTA que chama onClear", () => {
    const onClear = vi.fn();
    const { getByTestId } = renderWithProviders(
      <FavoritesFilteredEmptyState onClear={onClear} />,
    );
    expect(getByTestId("favorites-filtered-empty-state")).toBeTruthy();
    fireEvent.click(getByTestId("favorites-filtered-clear-cta"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
