import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents desligado: páginas client dynamic (/produto/[pid], /gastos/[id],
  // /minha-lista/[id]) usam useParams + React Query no browser, incompatível com
  // partial prerendering. Reavaliar quando migrar dynamic pages pra Server Components.
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

export default withNextIntl(nextConfig);
