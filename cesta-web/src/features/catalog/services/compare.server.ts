import type { Product } from "../types/catalog.types";

interface Envelope<T> {
  data: T;
}

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
 * Fetch /products/compare server-side (RSC). Endpoint é @Public — zero auth.
 * Tags multi-produto (`product:${id}`) permitem invalidar cache SSR quando
 * qualquer produto do set muda (reuso do RevalidateService Sprint 47/48).
 */
export async function fetchCompareSSR(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const qs = new URLSearchParams({ ids: ids.join(",") });
  const res = await fetch(`${resolveBaseUrl()}/products/compare?${qs}`, {
    headers: { "content-type": "application/json" },
    // Cesta prices mudam diariamente — revalidate 1h é razoável. Tags permitem
    // invalidação on-demand via RevalidateService (Sprint 47/48) quando
    // catalog-sync atualiza preço de qualquer produto do set.
    next: { revalidate: 3600, tags: ids.map((id) => `product:${id}`) },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch compare set: ${res.status}`);
  }
  const json = (await res.json()) as Envelope<Product[]>;
  return json.data;
}
