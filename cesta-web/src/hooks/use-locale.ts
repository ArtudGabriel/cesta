"use client";

import { useLocale as useNextIntlLocale } from "next-intl";

export type UILocale = "es" | "pt-BR";

// Sprint 82: promovido de features/catalog/hooks pra nível app — usado por
// catalog, reviews, favorites, product pages. Hook de locale é cross-feature
// por definição.
export function useLocale(): UILocale {
  const locale = useNextIntlLocale();
  return locale === "pt-BR" ? "pt-BR" : "es";
}
