import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
  // Flip final das flags desacoplado — Sprint 52.5 só adiciona Suspense
  // boundary em layout.tsx (unblocker) + LayoutSkeleton. Build local com
  // ambas: true passou verde após fix; Sprint 53 faz o flip definitivo.
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
