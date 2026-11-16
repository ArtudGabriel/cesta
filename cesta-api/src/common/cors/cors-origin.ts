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
