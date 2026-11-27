import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import { ScanButton } from "./scan-button";

const uploadState = {
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isSuccess: false,
  isError: false,
  error: null as Error | null,
  progress: 0,
};

vi.mock("../hooks/use-expenses", () => ({
  useUploadReceipt: () => uploadState,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// jsdom não tem URL.createObjectURL / revokeObjectURL
beforeEach(() => {
  vi.clearAllMocks();
  uploadState.mutate = vi.fn();
  uploadState.reset = vi.fn();
  uploadState.isPending = false;
  uploadState.isSuccess = false;
  uploadState.isError = false;
  uploadState.error = null;
  uploadState.progress = 0;
  global.URL.createObjectURL = vi.fn(() => "blob:preview");
  global.URL.revokeObjectURL = vi.fn();
});

function pickFile(container: HTMLElement, file: File) {
  const inputs = container.querySelectorAll('input[type="file"]');
  // Camera é o primeiro (capture="environment")
  const input = inputs[0] as HTMLInputElement;
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });
  fireEvent.change(input);
}

describe("ScanButton (Sprint 176)", () => {
  it("pick file válido → renderiza preview thumbnail com testid", () => {
    const { container, getByTestId } = renderWithProviders(<ScanButton />);
    const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });
    pickFile(container, file);
    expect(getByTestId("scan-button-preview")).toBeTruthy();
  });

  it("preview: Enviar → chama upload.mutate; Cancelar → reset + fecha preview", () => {
    const { container, getByTestId, queryByTestId } = renderWithProviders(
      <ScanButton />,
    );
    const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });
    pickFile(container, file);

    fireEvent.click(getByTestId("scan-button-submit"));
    expect(uploadState.mutate).toHaveBeenCalledWith(
      { file },
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );

    // Novo pick + Cancelar
    pickFile(container, file);
    fireEvent.click(getByTestId("scan-button-cancel"));
    expect(uploadState.reset).toHaveBeenCalled();
    expect(queryByTestId("scan-button-preview")).toBeNull();
  });

  it("isError inline: renderiza retry button + texto erro", () => {
    uploadState.isError = true;
    uploadState.error = new Error("Boom OCR");
    const { container, getByTestId } = renderWithProviders(<ScanButton />);
    const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });
    pickFile(container, file);

    expect(getByTestId("scan-button-error-text").textContent).toContain(
      "Boom OCR",
    );
    fireEvent.click(getByTestId("scan-button-retry"));
    expect(uploadState.mutate).toHaveBeenCalled();
  });

  it("isPending + progress=100 renderiza 'parsing' OCR processing text", () => {
    uploadState.isPending = true;
    uploadState.progress = 100;
    const { container, getByTestId } = renderWithProviders(<ScanButton />);
    const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });
    pickFile(container, file);
    expect(getByTestId("scan-button-ocr-processing")).toBeTruthy();
  });

  it("button scan tem min-h-44px (tap target cesta-identidade-visual §11)", () => {
    const { getByLabelText } = renderWithProviders(<ScanButton />);
    const scan = getByLabelText(/Escanear ticket/);
    expect(scan.className).toContain("min-h-[44px]");
  });

  it("S228 #15b: double-click fast → mutate chamado SÓ 1x (ref-guard inflight)", () => {
    const { container, getByTestId } = renderWithProviders(<ScanButton />);
    const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });
    pickFile(container, file);
    const submit = getByTestId("scan-button-submit");
    // Dois clicks síncronos antes do re-render do isPending=true:
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(uploadState.mutate).toHaveBeenCalledTimes(1);
  });

  it("S176 AJUSTE GDPR: preview wrapper masked + file.name/size SEM data-sentry-unmask inline (herda mask)", () => {
    const { container, getByTestId } = renderWithProviders(<ScanButton />);
    const file = new File(["x"], "ticket-pii-filename.jpg", {
      type: "image/jpeg",
    });
    pickFile(container, file);
    const preview = getByTestId("scan-button-preview");
    expect(preview.hasAttribute("data-sentry-mask")).toBe(true);
    // file.name <p> renderiza dentro do wrapper SEM data-sentry-unmask próprio
    const fileNameEl = Array.from(preview.querySelectorAll("p")).find((p) =>
      p.textContent?.includes("ticket-pii-filename.jpg"),
    );
    expect(fileNameEl).toBeTruthy();
    expect(fileNameEl?.hasAttribute("data-sentry-unmask")).toBe(false);
  });
});
