import { safeJsonLd } from "@/lib/json-ld";
import { HomeClient } from "./home-client";

// Sprint 88: server shell permite emitir JSON-LD WebSite + SearchAction
// no HTML inicial (SEO/rich results). Body da home continua em client component
// pra manter interações (search debounce, filtros, sort) sem SSR-first.
export default function HomePage() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://cesta.vercel.app";

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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteJsonLd) }}
      />
      <HomeClient />
    </>
  );
}
