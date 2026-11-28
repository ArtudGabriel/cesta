import createNextIntlPlugin from "next-intl/plugin";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
// Sprint 76 (P5): ANALYZE=true abre relatórios HTML em .next/analyze/ após build.
const withAnalyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

const nextConfig: NextConfig = {
  /* config options here */
  // Débito Sprint 1 fechado na Sprint 53. Habilitadas após Sprint 52.5 isolar
  // getLocale/getMessages em Suspense boundary (LocalizedShell) + série SC
  // refactor completa (Sprint 46/49/50/51). Rotas RSC renderizam ◐ Partial
  // Prerender; dynamic data streams sob Suspense.
  cacheComponents: true,
  partialPrefetching: true,
  // Sprint 76 (P5): formatos modernos de imagem reduzem payload de produto em
  // 30-60% vs JPEG. AVIF cai pra WebP → JPEG no fallback automático do Next.
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Sprint 135: R2 novo + Blob legacy durante bootstrap (ADR 0010).
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "**.mercadona.es" },
      { protocol: "https", hostname: "**.carrefour.es" },
      { protocol: "https", hostname: "**.alcampo.es" },
      { protocol: "https", hostname: "**.dia.es" },
      { protocol: "https", hostname: "**.lidl.es" },
      { protocol: "https", hostname: "**.froiz.com" },
      { protocol: "https", hostname: "**.aldi.es" },
      { protocol: "https", hostname: "images.openfoodfacts.org" },
      // Sprint 227 (#10 bundle): CDNs externos reais em imageUrl prod que
      // crasham Next Image SSR com "Invalid src prop ... hostname X is not
      // configured". Confirmado prod scan page 2: s7g10.scene7.com (Aldi
      // CDN Scene7 fallback) + prod-mercadona.imgix.net (Mercadona imgix
      // CDN fallback). froiz.com bare (sem subdominio) nao casa com
      // **.froiz.com — adicionar root domain tambem.
      { protocol: "https", hostname: "s7g10.scene7.com" },
      { protocol: "https", hostname: "prod-mercadona.imgix.net" },
      { protocol: "https", hostname: "froiz.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      {
        source: "/registro",
        destination: "/register",
        permanent: true,
      },
    ];
  },
  // Sprint 243c (ADR 0045 · Boss AJUSTE 2026-11-28): auth transport
  // first-party via Next rewrite.
  //
  // Problema: cesta-web.vercel.app + cesta-gsvc.onrender.com são sites
  // DIFERENTES na Public Suffix List. Browser trata requests do front pro
  // backend como cross-site. Refresh cookie `SameSite=lax` NÃO é incluído
  // em XHR cross-site (iPhone Safari ITP bloqueia mesmo None+Secure). Pós
  // 15min do access token, `fetch(/auth/refresh, credentials: 'include')`
  // chega sem cookie → 401 → user deslogado → "Token ausente" no
  // `jwt-auth.guard.ts:34`.
  //
  // Fix: proxy transparente /api/v1/:path* via Next rewrite. Browser passa
  // a enxergar a API como mesmo origin. Refresh cookie setado sem `Domain=`
  // vira first-party no vercel.app → SameSite=lax funciona + ITP passa.
  //
  // Fonte única da verdade (Boss replace-in-place rule · claude-geral-
  // consolidado): rewrite deriva destino do próprio NEXT_PUBLIC_API_URL
  // (já setado em Production = https://cesta-gsvc.onrender.com/api/v1).
  // Sem novo env var API_UPSTREAM — 8 fetchers SSR (page.tsx home,
  // product.server, compare.server, list.server, receipt.server,
  // admin.server, opengraph-image, receipt-detail-body) continuam lendo
  // NEXT_PUBLIC_API_URL absoluto; só o CLIENT axios/fetch passa a usar
  // `/api/v1` relativo (ver lib/api.ts).
  //
  // Latency extra: 1 hop cdg1 (Vercel edge) → oregon (Render), ~150-250ms
  // RTT. Trade-off aceito vs sessão quebrada a cada 15min.
  //
  // Rollback: `git revert <sha>` + push → Vercel auto-deploy reverte. Zero
  // env change necessária.
  async rewrites() {
    const raw = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
    if (!raw) return [];
    // NEXT_PUBLIC_API_URL já contém /api/v1 (convenção .env.example). O
    // `source` do rewrite também contém /api/v1 — destination precisa do
    // host origin SEM esse suffix. Strip, mas só se o suffix existe (caso
    // valor venha relativo tipo "/api/v1" dev legacy, pula rewrite).
    const base = raw.replace(/\/api\/v1$/, "");
    if (!base || base === raw) return [];
    return [
      {
        source: "/api/v1/:path*",
        destination: `${base}/api/v1/:path*`,
      },
    ];
  },
};

export default withSentryConfig(withAnalyzer(withNextIntl(nextConfig)), {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Sprint 60: release tracking — withSentryConfig anota upload de artifacts
  // (source maps) pro release específico, batendo com o `release` dos
  // sentry.*.config.ts. Sem SENTRY_AUTH_TOKEN, upload é disabled abaixo.
  release: {
    name: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  },
  // Sprint 55: source maps upload condicional em SENTRY_AUTH_TOKEN. Dev local
  // sem token → disable graceful. CI com secret → upload + delete pra não
  // vazar source maps no bundle de produção.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
});
