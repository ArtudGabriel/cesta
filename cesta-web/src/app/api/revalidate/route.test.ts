import { createHmac } from "node:crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";

// revalidateTag é no-op fora de request context Next — mock pra observar chamadas.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

import { revalidateTag } from "next/cache";
import { POST } from "./route";

const SECRET = "test-secret";

function hmacOf(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function makeRequest(opts: {
  hmac?: string | null;
  signWith?: string;
  body?: unknown;
  rawBody?: string;
}): Request {
  const headers = new Headers({ "content-type": "application/json" });
  const rawBody =
    opts.rawBody !== undefined
      ? opts.rawBody
      : opts.body !== undefined
        ? JSON.stringify(opts.body)
        : "";
  const providedHmac =
    opts.hmac !== undefined
      ? opts.hmac
      : opts.signWith !== undefined
        ? hmacOf(rawBody, opts.signWith)
        : hmacOf(rawBody);
  if (providedHmac !== null) {
    headers.set("x-revalidate-hmac", providedHmac);
  }
  return new Request("http://localhost/api/revalidate", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    vi.mocked(revalidateTag).mockClear();
    process.env.REVALIDATE_SECRET = SECRET;
  });

  it("HMAC válido + tags válidos → 200 + revalidateTag chamado por tag", async () => {
    const req = makeRequest({
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

  it("HMAC assinado com secret errado → 401 + revalidateTag não chamado", async () => {
    const req = makeRequest({
      signWith: "wrong-secret",
      body: { tags: ["product:abc"] },
    });
    // @ts-expect-error
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
  });

  it("HMAC ausente → 401", async () => {
    const req = makeRequest({
      hmac: null,
      body: { tags: ["product:abc"] },
    });
    // @ts-expect-error
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("HMAC correto mas body modificado → 401 (tamper)", async () => {
    const original = JSON.stringify({ tags: ["product:abc"] });
    const hmac = hmacOf(original);
    const tampered = JSON.stringify({ tags: ["product:xyz"] });
    const headers = new Headers({
      "content-type": "application/json",
      "x-revalidate-hmac": hmac,
    });
    const req = new Request("http://localhost/api/revalidate", {
      method: "POST",
      headers,
      body: tampered,
    });
    // @ts-expect-error
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
  });

  it("REVALIDATE_SECRET não configurado → 503", async () => {
    delete process.env.REVALIDATE_SECRET;
    const req = makeRequest({
      hmac: "anything",
      body: { tags: ["product:abc"] },
    });
    // @ts-expect-error
    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it("body inválido (não-array) → 400", async () => {
    const req = makeRequest({
      body: { tags: "product:abc" },
    });
    // @ts-expect-error
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
  });

  it("tags array contém non-string → 400", async () => {
    const req = makeRequest({
      body: { tags: ["ok", 42] },
    });
    // @ts-expect-error
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("JSON malformado → 400", async () => {
    const rawBody = "{not json";
    const headers = new Headers({
      "content-type": "application/json",
      "x-revalidate-hmac": hmacOf(rawBody),
    });
    const req = new Request("http://localhost/api/revalidate", {
      method: "POST",
      headers,
      body: rawBody,
    });
    // @ts-expect-error
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
