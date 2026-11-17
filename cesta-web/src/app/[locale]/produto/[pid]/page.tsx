import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { fetchProductSSR } from "@/features/catalog/services/product.server";
import { safeJsonLd } from "@/lib/json-ld";
import { ProductDetailBody } from "./product-detail-body";

const CUID_PATTERN = /^c[a-z0-9]{24,}$/;

interface PageProps {
  params: Promise<{ pid: string; locale: string }>;
}

function resolveBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://cesta-web.vercel.app"
  );
}

// Sprint 88 gate 4 fix: generateMetadata dinâmica por produto. fetchProductSSR
// é cacheado por Next (revalidate 1h + tag product:<id>), então chamada
// repetida de generateMetadata + page body resolve a UMA única rede fetch.
// Fallback (produto ausente / API offline) usa title genérico pra não quebrar
// o render — notFound() do body cuida da UX.
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { pid, locale } = await params;
  const tTitle = await getTranslations({ locale, namespace: "meta.title" });
  const tOg = await getTranslations({ locale, namespace: "meta.og" });
  const baseUrl = resolveBaseUrl();
  const canonical = `${baseUrl}/produto/${pid}`;

  if (!CUID_PATTERN.test(pid)) {
    return { title: `${tTitle("produto")} · Cesta` };
  }

  let product;
  try {
    product = await fetchProductSSR(pid);
  } catch {
    product = null;
  }

  if (!product) {
    return {
      title: `${tTitle("produto")} · Cesta`,
      alternates: { canonical },
    };
  }

  const title = `${product.name} · Cesta`;
  const description = tOg("productDescription", { name: product.name });
  // og:image / twitter:image apontam pra opengraph-image.tsx dinâmico, não /og-image.png
  // genérico (QA gate 4 round 2 P2). OG endpoint resolve nome+preço por produto.
  const ogImage = `${baseUrl}/produto/${pid}/opengraph-image`;

  // Sprint 88 gate 4 round 2: `other: { "og:type": "product" }` NÃO sobrescreve
  // Next default og:type=website — Next emite ambos ou prioriza openGraph.type.
  // Workaround: cast openGraph.type via `as unknown as "website"` — Next lê o
  // campo como string no runtime (next/dist/lib/metadata/generate/opengraph.ts)
  // e emite og:type=<string>, sem validar o union em runtime.
  const openGraph = {
    type: "product",
    title,
    description,
    url: canonical,
    siteName: "Cesta",
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: product.name,
      },
    ],
  } as unknown as Metadata["openGraph"];

  return {
    title,
    description,
    alternates: { canonical },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { pid } = await params;
  if (!CUID_PATTERN.test(pid)) notFound();
  const product = await fetchProductSSR(pid);
  if (!product) notFound();

  const baseUrl = resolveBaseUrl();
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

  // Google Rich Results exige campo `image` em Product (schema.org/Product).
  // Fallback /og-image.png garante elegibilidade mesmo sem imageUrl.
  const productImage = product.imageUrl ?? `${baseUrl}/og-image.png`;

  const productJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: canonical,
    image: productImage,
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
        dangerouslySetInnerHTML={{ __html: safeJsonLd(productJsonLd) }}
      />
      <ProductDetailBody product={product} />
    </>
  );
}
