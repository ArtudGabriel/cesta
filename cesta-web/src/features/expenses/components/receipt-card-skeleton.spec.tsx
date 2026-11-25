import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ReceiptCardSkeleton } from "./receipt-card-skeleton";

describe("ReceiptCardSkeleton (Sprint 161)", () => {
  it("role=presentation + aria-hidden + animate-pulse em cada placeholder", () => {
    const { getByTestId } = render(<ReceiptCardSkeleton />);
    const el = getByTestId("receipt-card-skeleton");
    expect(el.getAttribute("role")).toBe("presentation");
    expect(el.getAttribute("aria-hidden")).toBe("true");
    const pulses = el.querySelectorAll(".animate-pulse");
    // icon + 2 text rows + total = 4 placeholders
    expect(pulses.length).toBe(4);
  });
});
