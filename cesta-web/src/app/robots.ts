import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://cesta-web.vercel.app";

/**
 * Sprint 69: allow catálogo público (/ e /produto) + policy pages; disallow
 * rotas user-data (perfil, favoritos, gastos, listas, cesta, alertas,
 * comparar com params, auth, api).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/produto/", "/politica-privacidade", "/termos"],
        disallow: [
          "/perfil",
          "/favoritos",
          "/gastos",
          "/minha-lista",
          "/minha-cesta",
          "/alertas",
          "/comparar",
          "/login",
          "/register",
          "/api/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
