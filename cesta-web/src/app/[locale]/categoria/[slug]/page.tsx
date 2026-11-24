import { CategoriaClient } from "@/features/catalog/components/categoria-client";

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CategoriaPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  // Sprint 149: passamos searchParams do RSC pro Client Component. Evita
  // `useSearchParams` hook, que em `cacheComponents: true` força
  // dynamic render + Suspense wrapper — causa raiz de CategoriaClient não
  // montar `useProducts` (S147/S148 QA zero /api calls).
  const initialSearch: Record<string, string> = {};
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === "string") {
        initialSearch[key] = value.join(",");
      }
    } else if (typeof value === "string") {
      initialSearch[key] = value;
    }
  }
  return <CategoriaClient slug={slug} initialSearchParams={initialSearch} />;
}
