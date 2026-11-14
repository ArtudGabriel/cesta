import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents + partialPrefetching mantidos desligados: habilitação
  // tentada na Sprint 52 após série SC refactor (46/49/50/51), mas root layout
  // usa getLocale/getMessages/getTranslations (dinâmicos por Accept-Language)
  // sem Suspense boundary dedicado — Next 16 cacheComponents exige wrap ou
  // "use cache" em todo dynamic data access, inclusive /_not-found. Reativar
  // numa sprint própria quando i18n for isolado em boundary suspense/stream.
  // partialPrefetching requer cacheComponents, então acompanha.
  cacheComponents: false,
  partialPrefetching: false,
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
