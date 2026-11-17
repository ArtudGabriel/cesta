import { ImageResponse } from "next/og";
import { fetchProductSSR } from "@/features/catalog/services/product.server";

// Sprint 88: edge runtime deprecado em Next 16 + incompatível com
// nextConfig.cacheComponents. ImageResponse roda em nodejs (default) sem
// perda de funcionalidade; cold start fica mais alto mas o output é cacheável
// via metadataBase + Next Image optimization.
export const alt = "Cesta — comparación de precios";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ pid: string; locale: string }>;
}

const CESTA_GREEN = "#1b6b48";
const CREAM = "#F8F5F0";
const INK = "#2A2420";
const MUTED = "#6B6560";
const CORAL = "#E8513A";

// Sprint 88: OG dinâmico por produto via Next.js ImageResponse edge runtime.
// Erros de fetch (API down / produto removido) caem no fallback brand card
// — garante que share em social sempre renderize imagem válida (nunca 500).
export default async function ProductOpenGraphImage({ params }: Props) {
  const { pid } = await params;

  let productName: string | null = null;
  let brand: string | null = null;
  let cheapestPrice: number | null = null;
  try {
    const product = await fetchProductSSR(pid);
    if (product) {
      productName = product.name;
      brand = product.brand;
      cheapestPrice = product.cheapestPrice;
    }
  } catch {
    // Fall through para fallback brand card
  }

  if (!productName) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: CESTA_GREEN,
            color: CREAM,
          }}
        >
          <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -2 }}>
            Cesta
          </div>
          <div style={{ fontSize: 32, marginTop: 16, opacity: 0.85 }}>
            Comparador de precios · Madrid
          </div>
        </div>
      ),
      size,
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          backgroundColor: CREAM,
          color: INK,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 48,
            fontWeight: 800,
            color: CESTA_GREEN,
            letterSpacing: -1,
          }}
        >
          Cesta
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {brand && (
            <div
              style={{
                fontSize: 32,
                color: MUTED,
                marginBottom: 12,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              {brand}
            </div>
          )}
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.1,
              display: "flex",
            }}
          >
            {productName}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {cheapestPrice !== null ? (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                color: CORAL,
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 600 }}>desde</div>
              <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>
                {cheapestPrice.toFixed(2)}€
              </div>
            </div>
          ) : (
            <div />
          )}
          <div style={{ fontSize: 28, color: MUTED }}>
            cesta · Madrid
          </div>
        </div>
      </div>
    ),
    size,
  );
}
