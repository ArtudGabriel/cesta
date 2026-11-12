import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const LOCALE_COOKIE = "cesta:locale";
export const SUPPORTED_LOCALES = ["es", "pt-BR"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function pickLocale(raw: string | undefined): SupportedLocale {
  if (raw && (SUPPORTED_LOCALES as readonly string[]).includes(raw)) {
    return raw as SupportedLocale;
  }
  return "es";
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = pickLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const messages = (await import(`./messages/${locale}.json`)).default;
  return { locale, messages };
});
