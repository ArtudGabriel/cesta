import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
  // Débito Sprint 1 fechado na Sprint 53. Habilitadas após Sprint 52.5 isolar
  // getLocale/getMessages em Suspense boundary (LocalizedShell) + série SC
  // refactor completa (Sprint 46/49/50/51). Rotas RSC renderizam ◐ Partial
  // Prerender; dynamic data streams sob Suspense.
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
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
