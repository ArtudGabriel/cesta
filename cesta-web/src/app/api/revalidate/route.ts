import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

interface RevalidateBody {
  tags: unknown;
}

/**
 * Sprint 57: auth via HMAC-SHA256 do body (header `x-revalidate-hmac`).
 * Replace in place do `x-revalidate-secret` simples das Sprints 47/48 —
 * agora detecta tampering em trânsito. Secret continua compartilhado via
 * REVALIDATE_SECRET env; só o HMAC viaja.
 */
function hmacMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  const providedHmac = request.headers.get("x-revalidate-hmac");
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "REVALIDATE_SECRET not configured" },
      { status: 503 },
    );
  }
  if (!providedHmac) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Raw body necessário pra bater HMAC bit-a-bit (JSON.stringify do remetente).
  const body = await request.text();
  const expectedHmac = createHmac("sha256", secret).update(body).digest("hex");
  if (!hmacMatches(providedHmac, expectedHmac)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: RevalidateBody;
  try {
    parsed = JSON.parse(body) as RevalidateBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const tags = parsed.tags;
  if (!Array.isArray(tags) || !tags.every((t) => typeof t === "string")) {
    return NextResponse.json(
      { error: "tags must be string[]" },
      { status: 400 },
    );
  }

  // Next 16 exige profile; "default" invalida imediatamente respeitando
  // defaultCache. Fetch SSR em product.server.ts usa next.tags sem cache
  // profile explícito, então "default" bate certo.
  tags.forEach((tag) => revalidateTag(tag, "default"));
  return NextResponse.json({ revalidated: tags.length, tags });
}
