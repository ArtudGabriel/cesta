import { ImageResponse } from "next/og";

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
 * Sprint 88 gate 4 round 2: Satori exige `display: flex` explícito em TODO
 * `<div>` que renderiza múltiplos children (ou children + text misturados).
 * Omissão causa 500 com mensagem "Expected <div> to have explicit display:
 * flex" (Vercel runtime log 11:54Z). Padrão aplicado em todos os divs abaixo,
 * incluindo containers de um único child, pra evitar regressão silenciosa
 * quando a árvore for refatorada.
 */

// Sprint 89: AbortController 5s evita crawler timeout quando API Render spins
// down (cold start ~30s free tier). Fetch estourando AbortError cai no catch e
// aciona brandFallback — Vercel OG route completa em <6s e crawler recebe
// imagem válida em vez de 500/timeout. Timer sempre limpo via finally.
async function fetchProductForOg(pid: string): Promise<ProductForOg | null> {
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${base}/products/${pid}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 3600 },
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeout);
  }
}

function brandFallback() {
  try {
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
          <div
            style={{
              display: "flex",
              fontSize: 120,
              fontWeight: 800,
              letterSpacing: -2,
            }}
          >
            Cesta
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              marginTop: 16,
              opacity: 0.85,
            }}
          >
            Comparador de precios · Madrid
          </div>
        </div>
      ),
      size,
    );
  } catch {
    // Último recurso: resposta mínima válida pra crawler não receber 500.
    return new Response("", { status: 204 });
  }
}

export default async function ProductOpenGraphImage({ params }: Props) {
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
                  display: "flex",
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
                display: "flex",
                fontSize: 72,
                fontWeight: 700,
                lineHeight: 1.1,
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
                <div
                  style={{ display: "flex", fontSize: 28, fontWeight: 600 }}
                >
                  desde
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 96,
                    fontWeight: 800,
                    letterSpacing: -2,
                  }}
                >
                  {product.cheapestPrice.toFixed(2)}€
                </div>
              </div>
            ) : (
              <div style={{ display: "flex" }} />
            )}
            <div style={{ display: "flex", fontSize: 28, color: MUTED }}>
              cesta · Madrid
            </div>
          </div>
        </div>
      ),
      size,
    );
  } catch {
    return brandFallback();
  }
}
