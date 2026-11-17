// Sprint 87: team slug é env (VERCEL_TEAM_SLUG). Default mantém compat
// com o time atual (`gabriels-projects-f5aa3b24`), fork/rename do time no
// Vercel só precisa trocar a env — sem patch no código.
const DEFAULT_TEAM_SLUG = 'gabriels-projects-f5aa3b24';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildVercelPreviewRegex(teamSlug: string): RegExp {
  const slug = teamSlug.trim() || DEFAULT_TEAM_SLUG;
  return new RegExp(`^https:\\/\\/cesta-web-git-[a-z0-9-]+-${escapeRegex(slug)}\\.vercel\\.app$`);
}

export const VERCEL_PREVIEW_REGEX = buildVercelPreviewRegex(DEFAULT_TEAM_SLUG);

export function isAllowedOrigin(
  origin: string | undefined,
  whitelist: readonly string[],
  previewRegex: RegExp = VERCEL_PREVIEW_REGEX,
): boolean {
  if (!origin) return true;
  if (whitelist.includes(origin)) return true;
  return previewRegex.test(origin);
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
  previewRegex: RegExp = VERCEL_PREVIEW_REGEX,
): boolean {
  return method === 'OPTIONS' && !isAllowedOrigin(origin, whitelist, previewRegex);
}
