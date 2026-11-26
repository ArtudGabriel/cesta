/**
 * Brand constants — Sprint 193 (S71 nit close).
 *
 * Single source of truth em JS/TS para cores da marca Cesta usadas em
 * contextos onde CSS tokens Tailwind não resolvem (Next metadata, image
 * generation via sharp/satori, ImageResponse OG images).
 *
 * Mirror de `--color-*` no `app/globals.css` + `cesta-identidade-visual.md`.
 * Alterar aqui requer update sincronizado em ambos.
 */

export const BRAND_COLORS = {
  cestaGreen: "#1b6b48",
  cestaGreenLight: "#2d9163",
  cestaGreenDark: "#124a32",
  cream: "#F8F5F0",
  ink: "#2A2420",
} as const;

/** Convenience alias — cor primária exposta separada pra call-sites comuns. */
export const BRAND_GREEN = BRAND_COLORS.cestaGreen;
