import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { LoginGate } from "./login-gate";
import { renderWithProviders } from "@/test-utils";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("LoginGate", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it("não renderiza quando open=false", () => {
    renderWithProviders(<LoginGate open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renderiza modal com title + body da action review", () => {
    renderWithProviders(<LoginGate open onClose={() => {}} action="review" />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/valorar/i)).toBeTruthy();
  });

  it("renderiza modal com title da action favorite", () => {
    renderWithProviders(
      <LoginGate open onClose={() => {}} action="favorite" />,
    );
    expect(screen.getByText(/guardar/i)).toBeTruthy();
  });

  it("Escape fecha modal", () => {
    const onClose = vi.fn();
    renderWithProviders(<LoginGate open onClose={onClose} />);
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("'Ahora no' chama onClose", () => {
    const onClose = vi.fn();
    renderWithProviders(<LoginGate open onClose={onClose} />);
    fireEvent.click(screen.getByText(/ahora no/i));
    expect(onClose).toHaveBeenCalled();
  });

  it("'Entrar' navega /login com returnUrl encoded", () => {
    renderWithProviders(
      <LoginGate
        open
        onClose={() => {}}
        returnUrl="/produto/abc123"
        action="review"
      />,
    );
    fireEvent.click(screen.getByText(/^entrar$/i));
    expect(pushMock).toHaveBeenCalledWith(
      "/login?returnUrl=%2Fproduto%2Fabc123",
    );
  });

  it("'Entrar' sem returnUrl usa window.location.pathname+search", () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: "/comparar",
        search: "?products=a,b",
      },
    });
    renderWithProviders(<LoginGate open onClose={() => {}} />);
    fireEvent.click(screen.getByText(/^entrar$/i));
    expect(pushMock).toHaveBeenCalledWith(
      "/login?returnUrl=%2Fcomparar%3Fproducts%3Da%2Cb",
    );
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("click backdrop fecha modal", () => {
    const onClose = vi.fn();
    renderWithProviders(<LoginGate open onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalled();
  });
});
