import { CompareClient } from "@/features/catalog/components/compare-client";
import { fetchCompareSSR } from "@/features/catalog/services/compare.server";

const MAX = 4;

interface PageProps {
  searchParams: Promise<{ products?: string }>;
}

export default async function CompararPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const ids = (sp.products ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX);
  const initialData = ids.length >= 2 ? await fetchCompareSSR(ids) : [];
  return <CompareClient initialIds={ids} initialData={initialData} />;
}
