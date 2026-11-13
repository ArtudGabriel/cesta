import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

interface RevalidateBody {
  tags: unknown;
}

// Constant-time comparison: previne timing side-channel na validação do secret.
// timingSafeEqual exige buffers de mesmo tamanho — length check antes evita
// throw e mantém short-circuit O(1) pra provided vazio ou tamanho diferente.
function secretMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  const provided = request.headers.get("x-revalidate-secret");
  const expected = process.env.REVALIDATE_SECRET;

  if (!expected) {
    return NextResponse.json(
      { error: "REVALIDATE_SECRET not configured" },
      { status: 503 },
    );
  }
  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RevalidateBody;
  try {
    body = (await request.json()) as RevalidateBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const tags = body.tags;
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
