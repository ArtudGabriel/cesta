import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import { RegenerateConfirm } from "./regenerate-confirm";

describe("RegenerateConfirm", () => {
  it("open=false não renderiza modal", () => {
    const { container } = renderWithProviders(
      <RegenerateConfirm open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("open=true clica Confirmar → onConfirm chamado", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(
      <RegenerateConfirm open onConfirm={onConfirm} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Regenerar/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("clica Cancelar → onCancel chamado", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(
      <RegenerateConfirm open onConfirm={onConfirm} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("loading desabilita ambos botões", () => {
    renderWithProviders(
      <RegenerateConfirm
        open
        loading
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const confirm = screen.getByRole("button", { name: /Regenerar/i });
    const cancel = screen.getByRole("button", { name: /Cancelar/i });
    expect(confirm).toBeDisabled();
    expect(cancel).toBeDisabled();
  });
});
