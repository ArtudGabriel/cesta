/**
 * Sprint 213 (ADR 0025) — flag parse robusto pro BACKFILL_IMAGES_ENABLED.
 *
 * Reutiliza pattern S187 AUTO_SYNC_ON_BOOT: aceita 'true', 'TRUE', 'True', '1'
 * + leading/trailing whitespace. Anything else = disabled (default prod).
 */
export function isBackfillImagesEnabled(raw: string | undefined): boolean {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}
