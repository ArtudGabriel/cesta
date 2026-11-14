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
});
