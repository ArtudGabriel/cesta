import { defineRouting } from "next-intl/routing";

// Sprint 83: route group [locale] + localePrefix "never" preserva URL bare
// (cesta.vercel.app/produto/X sem /es/ ou /pt-BR/ visivel). Detecta locale
// via cookie cesta:locale > Accept-Language > default "es". Permite <html
// lang={locale}> dinamico em [locale]/layout.tsx sem quebrar cache do root
// (root agora minimo/ausente, cacheComponents preservado).
export const routing = defineRouting({
  locales: ["es", "pt-BR"],
  defaultLocale: "es",
  localePrefix: "never",
  localeCookie: {
    name: "cesta:locale",
    maxAge: 60 * 60 * 24 * 365,
  },
});

export type AppLocale = (typeof routing.locales)[number];
