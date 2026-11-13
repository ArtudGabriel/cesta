import type { Product } from "../types/catalog.types";

interface Envelope<T> {
  data: T;
}

// Server-only: API_URL sem NEXT_PUBLIC_ fica fora do bundle client.
// Prod exige explicit; dev tolera fallback pra NEXT_PUBLIC_API_URL pra zero-config.
// Lazy eval (não module-level) pra não crashar build/import quando env ainda
// não resolveu — Next build evalua page.tsx em prerender data collection.
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
 * Fetch produto server-side (RSC). Usa fetch nativo pra participar do
 * cache Next 16 + evitar axios singleton baseURL sem interceptors.
 * Endpoint /products/:id é @Public — zero auth header.
 * Retorna null em 404 pra caller chamar notFound() Next.
 */
export async function fetchProductSSR(id: string): Promise<Product | null> {
  const res = await fetch(`${resolveBaseUrl()}/products/${id}`, {
    headers: { "Content-Type": "application/json" },
    // Cesta prices mudam diariamente — revalidate 1h é razoável.
    next: { revalidate: 3600, tags: [`product:${id}`] },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch product ${id}: ${res.status}`);
  const json = (await res.json()) as Envelope<Product>;
  return json.data;
}
