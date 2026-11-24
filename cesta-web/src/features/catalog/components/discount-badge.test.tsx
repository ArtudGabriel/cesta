import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { DiscountBadge } from "./discount-badge";

const messages = {
  home: {
    discountOff: "-{percent}%",
    discountOffAria: "Descuento del {percent} por ciento",
  },
};

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("DiscountBadge", () => {
  it("renderiza -N% texto", () => {
    const { container } = render(
      wrap(<DiscountBadge discount={{ percent: 25, severity: "mid" }} />),
    );
    expect(container.textContent).toContain("-25%");
  });

  it("aplica classe amber pra severity=mid", () => {
    const { container } = render(
      wrap(<DiscountBadge discount={{ percent: 20, severity: "mid" }} />),
    );
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-amber");
  });

  it("aplica classe coral pra severity=high", () => {
    const { container } = render(
      wrap(<DiscountBadge discount={{ percent: 40, severity: "high" }} />),
    );
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-coral");
  });

  it("aplica classe cesta-green pra severity=low", () => {
    const { container } = render(
      wrap(<DiscountBadge discount={{ percent: 10, severity: "low" }} />),
    );
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-cesta-green");
  });

  it("aria-label descreve percent", () => {
    const { container } = render(
      wrap(<DiscountBadge discount={{ percent: 50, severity: "high" }} />),
    );
    const span = container.querySelector("span");
    expect(span?.getAttribute("aria-label")).toContain("50");
  });

  it("size=md aplica padding maior", () => {
    const { container } = render(
      wrap(
        <DiscountBadge
          discount={{ percent: 20, severity: "mid" }}
          size="md"
        />,
      ),
    );
    const span = container.querySelector("span");
    expect(span?.className).toContain("px-2");
  });
});
