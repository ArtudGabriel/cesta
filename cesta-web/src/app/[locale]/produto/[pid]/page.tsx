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

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://cesta.vercel.app";
  const canonical = `${baseUrl}/produto/${pid}`;

  // Sprint 88: Product + AggregateOffer schema.org. AggregateOffer agrega
  // múltiplos supermercados em low/highPrice sem poluir HTML com N Offer blocks
  // (Google aceita AggregateOffer pra rich results). Omite se produto sem preços.
  const availablePrices = product.prices
    .filter((p) => p.isAvailable)
    .map((p) => p.price);
  const hasOffers = availablePrices.length > 0;
  const lowPrice = hasOffers ? Math.min(...availablePrices) : null;
  const highPrice = hasOffers ? Math.max(...availablePrices) : null;

  const productJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: canonical,
    ...(product.imageUrl ? { image: product.imageUrl } : {}),
    ...(product.brand
      ? { brand: { "@type": "Brand", name: product.brand } }
      : {}),
  };

  if (hasOffers && lowPrice !== null && highPrice !== null) {
    productJsonLd.offers = {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: lowPrice.toFixed(2),
      highPrice: highPrice.toFixed(2),
      offerCount: availablePrices.length,
      availability: "https://schema.org/InStock",
    };
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <ProductDetailBody product={product} />
    </>
  );
}
