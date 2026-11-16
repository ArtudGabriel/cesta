import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export const LOCALE_COOKIE = "cesta:locale";
export const SUPPORTED_LOCALES = routing.locales;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Sprint 83: locale vem do [locale] segment (requestLocale, resolvido pelo
// middleware via cookie > Accept-Language > default). Fallback pra defaultLocale
// quando param ausente (rotas fora de [locale] como /sitemap.xml, /robots.txt
// ou /_not-found).
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  const messages = (await import(`./messages/${locale}.json`)).default;
  return { locale, messages };
});
