import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import { ComparisonEmptyState } from "./comparison-empty-state";

describe("ComparisonEmptyState (Sprint 169)", () => {
  it("count=0: title + body + CTA add + CTA explore → /", () => {
    const onAdd = vi.fn();
    const { getByTestId } = renderWithProviders(
      <ComparisonEmptyState count={0} onAdd={onAdd} />,
    );
    expect(getByTestId("comparison-empty-state")).toBeTruthy();
    const explore = getByTestId("comparison-empty-cta-explore");
    expect(explore.getAttribute("href")).toBe("/");
    fireEvent.click(getByTestId("comparison-empty-cta-add"));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("count=1: title variante 'Agrega al menos 1 producto más'", () => {
    const { getByTestId, getByText } = renderWithProviders(
      <ComparisonEmptyState count={1} onAdd={vi.fn()} />,
    );
    expect(getByTestId("comparison-empty-state")).toBeTruthy();
    expect(getByText("Agrega al menos 1 producto más")).toBeTruthy();
  });

  it("count=0: title variante 'Compara hasta 4 productos'", () => {
    const { getByText } = renderWithProviders(
      <ComparisonEmptyState count={0} onAdd={vi.fn()} />,
    );
    expect(getByText("Compara hasta 4 productos")).toBeTruthy();
  });
});
