import type { Product } from "../types/catalog.types";

interface Envelope<T> {
  data: T;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

/**
 * Fetch produto server-side (RSC). Usa fetch nativo pra participar do
 * cache Next 16 + evitar axios singleton baseURL sem interceptors.
 * Endpoint /products/:id é @Public — zero auth header.
 * Retorna null em 404 pra caller chamar notFound() Next.
 */
export async function fetchProductSSR(id: string): Promise<Product | null> {
  const res = await fetch(`${BASE_URL}/products/${id}`, {
    headers: { "Content-Type": "application/json" },
    // Cesta prices mudam diariamente — revalidate 1h é razoável.
    next: { revalidate: 3600, tags: [`product:${id}`] },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch product ${id}: ${res.status}`);
  const json = (await res.json()) as Envelope<Product>;
  return json.data;
}
