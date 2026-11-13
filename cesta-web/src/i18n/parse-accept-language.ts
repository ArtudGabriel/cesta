import { SUPPORTED_LOCALES, type SupportedLocale } from "./request";

/**
 * Parse `Accept-Language` header do browser e retorna locale suportado
 * mais prioritário, ou null se nenhum match. Ordenado por quality (q=).
 *
 * Exemplos:
 *  "pt-BR,pt;q=0.9,en;q=0.8" → "pt-BR"
 *  "es-ES,es;q=0.9,en;q=0.8" → "es"
 *  "fr-FR,en;q=0.8"          → null
 *  null | ""                 → null
 */
export function parseAcceptLanguage(
  header: string | null | undefined,
): SupportedLocale | null {
  if (!header) return null;
  const parts = header
    .split(",")
    .map((p) => {
      const [tagRaw, qPart] = p.trim().split(";");
      const tag = (tagRaw ?? "").toLowerCase();
      const qMatch = qPart?.match(/q=([\d.]+)/);
      const q = qMatch?.[1] ? parseFloat(qMatch[1]) : 1.0;
      return { tag, q };
    })
    .filter((p) => p.tag.length > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of parts) {
    if (tag.startsWith("pt")) return "pt-BR";
    if (tag.startsWith("es")) return "es";
  }
  return null;
}

// Re-export pra conveniência de consumers.
export { SUPPORTED_LOCALES };
export type { SupportedLocale };
