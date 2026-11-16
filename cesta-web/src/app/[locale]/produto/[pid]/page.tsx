import { notFound } from "next/navigation";
import { fetchProductSSR } from "@/features/catalog/services/product.server";
import { ProductDetailBody } from "./product-detail-body";

const CUID_PATTERN = /^c[a-z0-9]{24,}$/;

interface PageProps {
  params: Promise<{ pid: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { pid } = await params;
  if (!CUID_PATTERN.test(pid)) notFound();
  const product = await fetchProductSSR(pid);
  if (!product) notFound();
  return <ProductDetailBody product={product} />;
}
