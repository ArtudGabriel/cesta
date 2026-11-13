import { cookies } from "next/headers";
import type { ShoppingList } from "../types/shopping-list.types";

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
 * Fetch shopping-list server-side (RSC). Lista é user-scoped — backend exige
 * Authorization: Bearer. Reconstrói o token do cookie cesta_access_token
 * (lib/api.ts setAccessToken espelha em cookie pra SSR).
 *
 * Retorna null em 401/403/404 pra caller chamar notFound(). Tag `list:${id}`
 * permite revalidateTag dedicada no futuro.
 */
export async function fetchListSSR(id: string): Promise<ShoppingList | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;

  const res = await fetch(`${resolveBaseUrl()}/shopping-lists/${id}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    next: { tags: [`list:${id}`] },
  });
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch list ${id}: ${res.status}`);
  }
  const json = (await res.json()) as Envelope<ShoppingList>;
  return json.data;
}
