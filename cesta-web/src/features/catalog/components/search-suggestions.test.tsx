import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { SearchSuggestions } from "./search-suggestions";
import * as service from "../services/catalog.service";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

vi.mock("../hooks/use-recent-searches", () => ({
  useRecentSearches: () => ({
    recents: [],
    add: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  }),
}));

const messages = {
  home: {
    suggestions: {
      empty: 'Sin sugerencias para "{query}"',
      loading: "Buscando…",
      recentsTitle: "Recientes",
      clearAll: "Limpiar",
      removeRecent: "Quitar",
    },
  },
};

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="es" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe("SearchSuggestions", () => {
  beforeEach(() => {
    routerPush.mockReset();
    // jsdom não implementa scrollIntoView; mock noop pra setas não quebrarem.
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  it("mostra empty state quando query sem resultados", async () => {
    vi.spyOn(service.catalogService, "suggest").mockResolvedValue([]);
    const { findByText } = render(
      wrap(
        <SearchSuggestions
          query="xyz"
          onSelect={vi.fn()}
          onSelectRecent={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    );
    expect(await findByText(/Sin sugerencias para/i)).toBeTruthy();
  });

  it("renderiza lista produto + navega PDP ao click", async () => {
    vi.spyOn(service.catalogService, "suggest").mockResolvedValue([
      {
        id: "p1",
        name: "Leche entera Hacendado 1L",
        brand: "Hacendado",
        imageUrl: null,
        cheapestPrice: { value: 0.95, supermarketSlug: "merc", supermarketName: "Mercadona" },
      },
    ] as unknown as Awaited<ReturnType<typeof service.catalogService.suggest>>);
    const onSelect = vi.fn();
    const { findByRole } = render(
      wrap(
        <SearchSuggestions
          query="leche"
          onSelect={onSelect}
          onSelectRecent={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    );
    const link = await findByRole("option");
    fireEvent.click(link);
    expect(onSelect).toHaveBeenCalled();
  });

  it("S237: Enter vai pra tela de resultados (/?q=...) não pro produto", async () => {
    vi.spyOn(service.catalogService, "suggest").mockResolvedValue([
      {
        id: "p1",
        name: "Leche entera",
        brand: null,
        imageUrl: null,
        cheapestPrice: null,
      },
    ] as unknown as Awaited<ReturnType<typeof service.catalogService.suggest>>);
    const onSelect = vi.fn();
    const { findByRole } = render(
      wrap(
        <SearchSuggestions
          query="leche entera"
          onSelect={onSelect}
          onSelectRecent={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    );
    await findByRole("option");
    fireEvent.keyDown(document, { key: "Enter" });
    expect(routerPush).toHaveBeenCalledWith("/?q=leche%20entera");
    expect(routerPush).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/produto\//),
    );
    expect(onSelect).toHaveBeenCalled();
  });

  it("S237: Enter com seta mesmo item highlighted ainda vai pra resultados", async () => {
    vi.spyOn(service.catalogService, "suggest").mockResolvedValue([
      {
        id: "p1",
        name: "Leche entera",
        brand: null,
        imageUrl: null,
        cheapestPrice: null,
      },
    ] as unknown as Awaited<ReturnType<typeof service.catalogService.suggest>>);
    const { findByRole } = render(
      wrap(
        <SearchSuggestions
          query="leche"
          onSelect={vi.fn()}
          onSelectRecent={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    );
    await findByRole("option");
    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.keyDown(document, { key: "Enter" });
    expect(routerPush).toHaveBeenCalledWith("/?q=leche");
    expect(routerPush).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/produto\//),
    );
  });

  it("Escape dispara onClose", async () => {
    vi.spyOn(service.catalogService, "suggest").mockResolvedValue([
      {
        id: "p1",
        name: "Leche",
        brand: null,
        imageUrl: null,
        cheapestPrice: null,
      },
    ] as unknown as Awaited<ReturnType<typeof service.catalogService.suggest>>);
    const onClose = vi.fn();
    const { findByRole } = render(
      wrap(
        <SearchSuggestions
          query="leche"
          onSelect={vi.fn()}
          onSelectRecent={vi.fn()}
          onClose={onClose}
        />,
      ),
    );
    await findByRole("option");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
