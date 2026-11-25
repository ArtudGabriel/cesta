import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AlertCardSkeleton } from "./alert-card-skeleton";
import { AlertRuleCardSkeleton } from "./alert-rule-card-skeleton";

describe("Alert skeletons (Sprint 161)", () => {
  it("AlertCardSkeleton: role=presentation + aria-hidden + animate-pulse em cada placeholder", () => {
    const { getByTestId } = render(<AlertCardSkeleton />);
    const el = getByTestId("alert-card-skeleton");
    expect(el.getAttribute("role")).toBe("presentation");
    expect(el.getAttribute("aria-hidden")).toBe("true");
    const pulses = el.querySelectorAll(".animate-pulse");
    // thumbnail + 3 text rows + 2 action buttons = 6 placeholders
    expect(pulses.length).toBe(6);
  });

  it("AlertRuleCardSkeleton: role=presentation + aria-hidden + animate-pulse em cada placeholder", () => {
    const { getByTestId } = render(<AlertRuleCardSkeleton />);
    const el = getByTestId("alert-rule-card-skeleton");
    expect(el.getAttribute("role")).toBe("presentation");
    expect(el.getAttribute("aria-hidden")).toBe("true");
    const pulses = el.querySelectorAll(".animate-pulse");
    // title + subtitle + 2 action buttons = 4 placeholders
    expect(pulses.length).toBe(4);
  });
});
