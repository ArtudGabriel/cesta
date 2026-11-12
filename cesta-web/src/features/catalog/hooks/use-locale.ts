"use client";

import { useLocale as useNextIntlLocale } from "next-intl";

export type UILocale = "es" | "pt-BR";

export function useLocale(): UILocale {
  const locale = useNextIntlLocale();
  return locale === "pt-BR" ? "pt-BR" : "es";
}
