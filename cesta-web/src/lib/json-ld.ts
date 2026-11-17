/**
 * Serializa objeto para JSON-LD embutido em <script type="application/ld+json">.
 *
 * Substitui `<` por `<` no output. Previne XSS via injeção de `</script>`
 * (ou `<!--`, `<script`) quando o payload inclui strings controladas por fonte
 * externa — ex: `product.name` vindo de catalog-sync adapter ou de correção
 * crowdsourced via receipt OCR (ver cesta.md). O escape mantém o JSON válido
 * porque `<` é representação unicode canônica do caractere `<`.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
