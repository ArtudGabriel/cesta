export const VERCEL_PREVIEW_REGEX =
  /^https:\/\/cesta-web-git-[a-z0-9-]+-gabriels-projects-f5aa3b24\.vercel\.app$/;

export function isAllowedOrigin(
  origin: string | undefined,
  whitelist: readonly string[],
): boolean {
  if (!origin) return true;
  if (whitelist.includes(origin)) return true;
  return VERCEL_PREVIEW_REGEX.test(origin);
}

export function parseCorsWhitelist(raw: string | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  return Array.from(new Set(trimmed));
}

// Sprint 82: QA Sprint 80 observou OPTIONS → 404 pra origin fora do whitelist.
// Causa: pacote `cors` em callback(null,false) só suprime ACAO e chama next();
// Nest routing não tem handler de OPTIONS → 404. Semântica correta: 403 + Vary.
// Mantemos helper isolado pra permitir spec unitária.
export function isRejectedPreflight(
  method: string,
  origin: string | undefined,
  whitelist: readonly string[],
): boolean {
  return method === 'OPTIONS' && !isAllowedOrigin(origin, whitelist);
}
