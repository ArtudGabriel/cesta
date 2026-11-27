import type { Category } from "@/features/catalog/types/catalog.types";
import type { UILocale } from "@/hooks/use-locale";

/**
 * Sprint 227 — label locale-aware pra Category. Centraliza regra de fallback
 * (namePt vazio → nameEs). Reutilizada por home-client, HomeEmptyState,
 * basket-category-group e qualquer tela que render categoria vinda do backend.
 */
export function categoryLabel(cat: Category, locale: UILocale): string {
  if (locale === "pt-BR" && cat.namePt && cat.namePt.trim().length > 0) {
    return cat.namePt;
  }
  return cat.nameEs;
}
