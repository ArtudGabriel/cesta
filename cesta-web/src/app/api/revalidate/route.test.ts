import { describe, it, expect, beforeEach, vi } from "vitest";

// revalidateTag é no-op fora de request context Next — mock pra observar chamadas.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

import { revalidateTag } from "next/cache";
import { POST } from "./route";

function makeRequest(opts: {
  secret?: string | null;
  body?: unknown;
  rawBody?: string;
}): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (opts.secret !== null && opts.secret !== undefined) {
    headers.set("x-revalidate-secret", opts.secret);
  }
  const body =
    opts.rawBody !== undefined
      ? opts.rawBody
      : opts.body !== undefined
        ? JSON.stringify(opts.body)
        : undefined;
  return new Request("http://localhost/api/revalidate", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    vi.mocked(revalidateTag).mockClear();
    process.env.REVALIDATE_SECRET = "test-secret";
  });

  it("secret match + tags válidos → 200 + revalidateTag chamado por tag", async () => {
    const req = makeRequest({
      secret: "test-secret",
      body: { tags: ["product:abc", "product:xyz"] },
    });
    // @ts-expect-error — NextRequest estende Request; aceita Request em runtime.
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { revalidated: number; tags: string[] };
    expect(json.revalidated).toBe(2);
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(revalidateTag)).toHaveBeenNthCalledWith(1, "product:abc", "default");
    expect(vi.mocked(revalidateTag)).toHaveBeenNthCalledWith(2, "product:xyz", "default");
  });

  it("secret errado → 401 + revalidateTag não chamado", async () => {
    const req = makeRequest({
      secret: "wrong",
      body: { tags: ["product:abc"] },
    });
    // @ts-expect-error
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
  });

  it("secret ausente → 401", async () => {
    const req = makeRequest({
      secret: null,
      body: { tags: ["product:abc"] },
    });
    // @ts-expect-error
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("REVALIDATE_SECRET não configurado → 503", async () => {
    delete process.env.REVALIDATE_SECRET;
    const req = makeRequest({
      secret: "anything",
      body: { tags: ["product:abc"] },
    });
    // @ts-expect-error
    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it("body inválido (não-array) → 400", async () => {
    const req = makeRequest({
      secret: "test-secret",
      body: { tags: "product:abc" },
    });
    // @ts-expect-error
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
  });

  it("tags array contém non-string → 400", async () => {
    const req = makeRequest({
      secret: "test-secret",
      body: { tags: ["ok", 42] },
    });
    // @ts-expect-error
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("JSON malformado → 400", async () => {
    const req = makeRequest({
      secret: "test-secret",
      rawBody: "{not json",
    });
    // @ts-expect-error
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
