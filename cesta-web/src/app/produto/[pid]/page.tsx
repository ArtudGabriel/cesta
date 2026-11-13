import { notFound } from "next/navigation";
import { fetchProductSSR } from "@/features/catalog/services/product.server";
import { ProductDetailBody } from "./product-detail-body";

interface PageProps {
  params: Promise<{ pid: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { pid } = await params;
  const product = await fetchProductSSR(pid);
  if (!product) notFound();
  return <ProductDetailBody product={product} />;
}
