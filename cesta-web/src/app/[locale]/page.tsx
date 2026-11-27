import { safeJsonLd } from "@/lib/json-ld";
import type { Category } from "@/features/catalog/types/catalog.types";
import { HomeClient } from "./home-client";

// Sprint 227 (#2 perf): server shell pré-busca categorias com revalidate
// 1h (next fetch cache). HomeClient recebe initialCategories e hidrata
// o useQuery sem flash dos skeleton chips. Produtos continuam client-side
// por conta dos filtros dependerem de URL/preferências locais.
export const revalidate = 300;

async function fetchCategoriesSSR(): Promise<Category[]> {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
  try {
    const res = await fetch(`${baseUrl}/categories`, {
      next: { revalidate: 3600, tags: ["categories"] },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Category[] };
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

// Sprint 88: server shell permite emitir JSON-LD WebSite + SearchAction
// no HTML inicial (SEO/rich results). Body da home continua em client component
// pra manter interações (search debounce, filtros, sort) sem SSR-first.
export default async function HomePage() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://cesta-web.vercel.app";

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Cesta",
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const initialCategories = await fetchCategoriesSSR();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteJsonLd) }}
      />
      <HomeClient initialCategories={initialCategories} />
    </>
  );
}
