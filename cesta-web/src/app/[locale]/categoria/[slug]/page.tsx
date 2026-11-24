import { CategoriaClient } from "@/features/catalog/components/categoria-client";

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export default async function CategoriaPage({ params }: PageProps) {
  const { slug } = await params;
  return <CategoriaClient slug={slug} />;
}
