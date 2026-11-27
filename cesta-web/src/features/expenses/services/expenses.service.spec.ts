import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "@/lib/api";
import { expensesService } from "./expenses.service";

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  post: ReturnType<typeof vi.fn>;
};

describe("expensesService.uploadReceipt (Sprint 228 #15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.post.mockResolvedValue({
      data: { data: { jobId: "j1", receiptId: "r1", status: "queued" } },
    });
  });

  it("usa adapter xhr per-request (progress nativo + Authorization preservada)", async () => {
    const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });
    await expensesService.uploadReceipt(file);
    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockedApi.post.mock.calls[0];
    expect(url).toBe("/receipts");
    expect(body).toBeInstanceOf(FormData);
    expect(config?.adapter).toBe("xhr");
  });

  it("NÃO seta Content-Type (browser deriva boundary multipart)", async () => {
    const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });
    await expensesService.uploadReceipt(file);
    const [, , config] = mockedApi.post.mock.calls[0];
    expect(config?.headers).toBeUndefined();
  });

  it("propaga onProgress com percentual arredondado", async () => {
    mockedApi.post.mockImplementation(async (_url, _body, config) => {
      config?.onUploadProgress?.({ loaded: 50, total: 200 });
      config?.onUploadProgress?.({ loaded: 200, total: 200 });
      return {
        data: { data: { jobId: "j1", receiptId: "r1", status: "queued" } },
      };
    });
    const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });
    const progressSpy = vi.fn();
    await expensesService.uploadReceipt(file, undefined, progressSpy);
    expect(progressSpy).toHaveBeenNthCalledWith(1, 25);
    expect(progressSpy).toHaveBeenNthCalledWith(2, 100);
  });

  it("onProgress sem event.total → não dispara callback", async () => {
    mockedApi.post.mockImplementation(async (_url, _body, config) => {
      config?.onUploadProgress?.({ loaded: 100, total: 0 });
      return {
        data: { data: { jobId: "j1", receiptId: "r1", status: "queued" } },
      };
    });
    const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });
    const progressSpy = vi.fn();
    await expensesService.uploadReceipt(file, undefined, progressSpy);
    expect(progressSpy).not.toHaveBeenCalled();
  });

  it("notes opcional vai no FormData quando presente", async () => {
    const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });
    await expensesService.uploadReceipt(file, "obs manual");
    const [, body] = mockedApi.post.mock.calls[0] as [string, FormData, unknown];
    expect(body.get("image")).toBe(file);
    expect(body.get("notes")).toBe("obs manual");
  });

  it("notes ausente → só image no FormData", async () => {
    const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });
    await expensesService.uploadReceipt(file);
    const [, body] = mockedApi.post.mock.calls[0] as [string, FormData, unknown];
    expect(body.get("image")).toBe(file);
    expect(body.has("notes")).toBe(false);
  });

  it("retorna shape { jobId, receiptId, status } do envelope.data", async () => {
    const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });
    const result = await expensesService.uploadReceipt(file);
    expect(result).toEqual({
      jobId: "j1",
      receiptId: "r1",
      status: "queued",
    });
  });
});
