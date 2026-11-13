import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { parseAcceptLanguage } from "./parse-accept-language";

export const LOCALE_COOKIE = "cesta:locale";
export const SUPPORTED_LOCALES = ["es", "pt-BR"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupported(raw: string | null | undefined): raw is SupportedLocale {
  return Boolean(
    raw && (SUPPORTED_LOCALES as readonly string[]).includes(raw),
  );
}

export default getRequestConfig(async () => {
  // Hierarquia: cookie > Accept-Language (deslogado) > default "es".
  // Profile locale é aplicado pelo cliente via setCookie no /perfil toggle,
  // então cai no cookie quando user está logado (Sprint 8).
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;

  let locale: SupportedLocale = "es";
  if (isSupported(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const headerStore = await headers();
    const detected = parseAcceptLanguage(headerStore.get("accept-language"));
    if (detected) locale = detected;
  }

  const messages = (await import(`./messages/${locale}.json`)).default;
  return { locale, messages };
});
