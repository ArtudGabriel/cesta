import { notFound } from "next/navigation";
import { ListDetailClient } from "@/features/shopping-lists/components/list-detail-client";
import { fetchListSSR } from "@/features/shopping-lists/services/list.server";

const CUID_PATTERN = /^c[a-z0-9]{24,}$/;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ListDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!CUID_PATTERN.test(id)) notFound();
  const list = await fetchListSSR(id);
  if (!list) notFound();
  return <ListDetailClient initialList={list} />;
}
