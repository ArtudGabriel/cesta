import { ImageResponse } from "next/og";

// Sprint 88 gate 4 fix: edge runtime deprecado em Next 16 + incompatível com
// nextConfig.cacheComponents. ImageResponse roda em nodejs (default).
export const alt = "Cesta — comparación de precios";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ pid: string; locale: string }>;
}

interface ProductForOg {
  name: string;
  brand: string | null;
  cheapestPrice: number | null;
}

const CESTA_GREEN = "#1b6b48";
const CREAM = "#F8F5F0";
const INK = "#2A2420";
const MUTED = "#6B6560";
const CORAL = "#E8513A";

/**
 * Fetch resilient especificamente pra OG image handler. Diferente de
 * fetchProductSSR que lança em prod quando API_URL ausente, aqui aceitamos
 * NEXT_PUBLIC_API_URL como fallback — handler nunca retorna 500 por env var
 * faltando (Sprint 88 gate 4 bug: /opengraph-image 500 em todos produtos).
 */
async function fetchProductForOg(pid: string): Promise<ProductForOg | null> {
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/products/${pid}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data: { name: string; brand: string | null; cheapestPrice: number | null };
    };
    return {
      name: json.data.name,
      brand: json.data.brand,
      cheapestPrice: json.data.cheapestPrice,
    };
  } catch {
    return null;
  }
}

function brandFallback() {
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

export default async function ProductOpenGraphImage({ params }: Props) {
  // Outer try/catch envolve tudo — qualquer falha (Satori render, fetch,
  // JSON parse, env missing) cai no brand card. Nunca 500 pra consumidor OG
  // (crawlers Twitter/FB/Discord), que já é problema reportado no gate 4.
  try {
    const { pid } = await params;
    const product = await fetchProductForOg(pid);
    if (!product) return brandFallback();

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
            {product.brand && (
              <div
                style={{
                  fontSize: 32,
                  color: MUTED,
                  marginBottom: 12,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
              >
                {product.brand}
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
              {product.name}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {product.cheapestPrice !== null ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 12,
                  color: CORAL,
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 600 }}>desde</div>
                <div
                  style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2 }}
                >
                  {product.cheapestPrice.toFixed(2)}€
                </div>
              </div>
            ) : (
              <div />
            )}
            <div style={{ fontSize: 28, color: MUTED }}>cesta · Madrid</div>
          </div>
        </div>
      ),
      size,
    );
  } catch {
    return brandFallback();
  }
}
