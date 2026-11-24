import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { PackageInfoStrip } from "./package-info-strip";

vi.mock("@/hooks/use-locale", () => ({
  useLocale: () => "es",
}));

const messages = {
  product: {
    packageAria: "Envase de {size} {unit}",
  },
};

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("PackageInfoStrip", () => {
  it("renderiza 1,5 L para LITER packageSize=1.5", () => {
    const { container } = render(
      wrap(<PackageInfoStrip packageSize={1.5} packageUnit="LITER" />),
    );
    expect(container.textContent).toContain("1,5");
    expect(container.textContent).toContain("L");
  });

  it("renderiza 500 g para GRAM packageSize=500", () => {
    const { container } = render(
      wrap(<PackageInfoStrip packageSize={500} packageUnit="GRAM" />),
    );
    expect(container.textContent).toContain("500");
    expect(container.textContent).toContain("g");
  });

  it("renderiza 12 ud para UNIT packageSize=12", () => {
    const { container } = render(
      wrap(<PackageInfoStrip packageSize={12} packageUnit="UNIT" />),
    );
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("ud");
  });

  it("aria-label descreve envase + unidade", () => {
    const { container } = render(
      wrap(<PackageInfoStrip packageSize={1} packageUnit="KILOGRAM" />),
    );
    const span = container.querySelector("[aria-label]");
    expect(span?.getAttribute("aria-label")).toContain("1");
    expect(span?.getAttribute("aria-label")).toContain("kg");
  });

  it("aceita MILLILITER renderizando ml", () => {
    const { container } = render(
      wrap(<PackageInfoStrip packageSize={330} packageUnit="MILLILITER" />),
    );
    expect(container.textContent).toContain("330");
    expect(container.textContent).toContain("ml");
  });
});
