import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "@testing-library/react";
import { ColdStartHint } from "./cold-start-hint";
import { renderWithProviders } from "@/test-utils";

describe("ColdStartHint", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("não renderiza nada antes do delay", () => {
    const { container } = renderWithProviders(
      <ColdStartHint active delayMs={3000} />,
    );
    expect(container.textContent).toBe("");
  });

  it("aparece após delayMs quando active", () => {
    const { container } = renderWithProviders(
      <ColdStartHint active delayMs={3000} />,
    );
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(container.textContent).toMatch(/servidor/i);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  it("não aparece se active=false", () => {
    const { container } = renderWithProviders(
      <ColdStartHint active={false} delayMs={3000} />,
    );
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(container.textContent).toBe("");
  });

  it("some quando active flipa pra false mid-timer", () => {
    const { container, rerender } = renderWithProviders(
      <ColdStartHint active delayMs={3000} />,
    );
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(container.textContent).toMatch(/servidor/i);

    rerender(<ColdStartHint active={false} delayMs={3000} />);
    expect(container.textContent).toBe("");
  });

  it("não aparece se active flipa pra false antes do delay", () => {
    const { container, rerender } = renderWithProviders(
      <ColdStartHint active delayMs={3000} />,
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    rerender(<ColdStartHint active={false} delayMs={3000} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(container.textContent).toBe("");
  });
});
