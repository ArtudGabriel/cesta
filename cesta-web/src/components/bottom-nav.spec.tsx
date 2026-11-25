import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils";
import { BottomNav } from "./bottom-nav";

const mockPathname = vi.fn<() => string>(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const profileData: unknown = {
  id: "u-1",
  email: "qa@test.com",
  phone: null,
  name: "QA",
  locale: "es",
  roles: ["user"],
  emailVerifiedAt: null,
  createdAt: new Date().toISOString(),
  prefersVegan: false,
  prefersVegetarian: false,
  prefersGlutenFree: false,
  prefersLactoseFree: false,
};

vi.mock("@/features/profile/hooks/use-profile", () => ({
  useProfile: () => ({ data: profileData, isError: false }),
}));

describe("BottomNav (Sprint 171)", () => {
  it("home route ativa → aria-current='page' + text-cesta-green", () => {
    mockPathname.mockReturnValue("/");
    const { getByTestId } = renderWithProviders(<BottomNav />);
    const home = getByTestId("bottom-nav-home");
    expect(home.getAttribute("aria-current")).toBe("page");
    expect(home.className).toContain("text-cesta-green");
  });

  it("outras rotas → aria-current undefined + text-neutral", () => {
    mockPathname.mockReturnValue("/favoritos");
    const { getByTestId } = renderWithProviders(<BottomNav />);
    const home = getByTestId("bottom-nav-home");
    expect(home.getAttribute("aria-current")).toBeNull();
    expect(home.className).toContain("text-neutral-500");
    const favs = getByTestId("bottom-nav-favorites");
    expect(favs.getAttribute("aria-current")).toBe("page");
  });

  it("tap feedback: active:scale-95 + motion-reduce:active:scale-100", () => {
    mockPathname.mockReturnValue("/");
    const { getByTestId } = renderWithProviders(<BottomNav />);
    const home = getByTestId("bottom-nav-home");
    expect(home.className).toContain("active:scale-95");
    expect(home.className).toContain("motion-reduce:active:scale-100");
    expect(home.className).toContain("motion-reduce:transition-none");
  });

  it("perfil subroute matches /perfil prefix", () => {
    mockPathname.mockReturnValue("/perfil/settings");
    const { getByTestId } = renderWithProviders(<BottomNav />);
    const account = getByTestId("bottom-nav-account");
    expect(account.getAttribute("aria-current")).toBe("page");
  });
});
