import * as Sentry from "@sentry/nextjs";
import type { Product } from "@/features/catalog/types/catalog.types";
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
  // Sprint 202 (resilience): SSR fetch pode falhar (API offline, timeout,
  // ids inválidos). Em vez de propagar o throw e cair no error.tsx, degradar
  // gracioso pra initialData=[] — CompareClient hidrata + useCompare
  // client-side refetch dispara (enabled quando ids>=2). Pior caso: usuário
  // vê o loader em vez de erro, API volta, dados aparecem.
  //
  // Sprint 202 AJUSTE Reviewer: capture via Sentry (não silent-swallow).
  // claude-geral-consolidado "no-silent-swallow" + silent-failure-hunter
  // rule — catch block precisa observar o erro, não só degradar.
  let initialData: Product[] = [];
  if (ids.length >= 2) {
    try {
      initialData = await fetchCompareSSR(ids);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { source: "comparar-ssr" },
        extra: { productIds: ids },
      });
      initialData = [];
    }
  }
  return <CompareClient initialIds={ids} initialData={initialData} />;
}
