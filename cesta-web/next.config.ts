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
  // Sprint 243c (ADR 0045): auth transport first-party.
  //
  // Problema: cesta-web.vercel.app + cesta-gsvc.onrender.com são sites
  // DIFERENTES na Public Suffix List. Browser trata requests do front pro
  // backend como cross-site. Refresh cookie setado pelo backend com
  // SameSite='lax' + Secure + httpOnly NÃO é incluído em XHR cross-site
  // (nem em iPhone Safari que tem ITP agressivo além do SameSite). Pós
  // expiração dos 15min do access token, `fetch(/auth/refresh,
  // credentials: 'include')` chega ao backend sem cookie → 401 → user
  // é deslogado e qualquer ação logada retorna "Token ausente" em
  // `jwt-auth.guard.ts:34`.
  //
  // Fix: proxy transparente /api/v1/:path* via Next rewrite. Browser passa
  // a enxergar a API como mesmo origin (cesta-web.vercel.app/api/v1/...).
  // Refresh cookie é setado pelo backend sem `Domain=` attribute → Next
  // repassa Set-Cookie → browser atribui ao domínio do request
  // (vercel.app) → cookie fica first-party → SameSite=lax funciona + ITP
  // Safari deixa passar.
  //
  // API_UPSTREAM é server-side only (sem prefix NEXT_PUBLIC) — não
  // vaza upstream pro client bundle. SSR em `receipt.server.ts` continua
  // chamando direto o upstream via `API_URL` (server-to-server, sem
  // sentido rotear via Vercel edge).
  //
  // Latency extra: 1 hop cdg1 (Vercel edge) → oregon (Render). Medido
  // em S243c (anotado PR body). Aceito como trade-off vs sessão quebrada
  // a cada 15min.
  //
  // Rollback: remover o bloco de rewrites + reverter baseURL em
  // lib/api.ts. Deploy do Vercel rolls back automatic via revert do commit.
  async rewrites() {
    const upstream = process.env.API_UPSTREAM?.replace(/\/+$/, "");
    if (!upstream) return [];
    return [
      {
        source: "/api/v1/:path*",
        destination: `${upstream}/api/v1/:path*`,
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
