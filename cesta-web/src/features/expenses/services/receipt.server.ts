import { cookies } from "next/headers";
import type { Receipt } from "../types/expense.types";

interface Envelope<T> {
  data: T;
}

const ACCESS_TOKEN_COOKIE = "cesta_access_token";

function resolveBaseUrl(): string {
  const serverOnly = process.env.API_URL;
  if (serverOnly) return serverOnly;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "API_URL env var is required in production for SSR fetches (sem NEXT_PUBLIC_ prefix).",
    );
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
}

/**
 * Fetch receipt server-side (RSC). Receipts são user-scoped — backend exige
 * Authorization: Bearer. Reconstrói o token do cookie `cesta_access_token`
 * que o `setAccessToken` (lib/api.ts) persiste tanto em localStorage quanto
 * em cookie pra ser lido via next/headers no server.
 *
 * Retorna null em 401/403/404 pra caller chamar notFound() ou redirect.
 * Tag `receipt:${id}` permite revalidateTag dedicada no futuro.
 */
export async function fetchReceiptSSR(id: string): Promise<Receipt | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;

  const res = await fetch(`${resolveBaseUrl()}/receipts/${id}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    next: { tags: [`receipt:${id}`] },
  });
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch receipt ${id}: ${res.status}`);
  }
  const json = (await res.json()) as Envelope<Receipt>;
  return json.data;
}
