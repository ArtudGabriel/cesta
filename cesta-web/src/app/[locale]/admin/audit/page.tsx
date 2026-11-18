import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuditLogCard } from "@/features/admin/components/audit-log-card";
import { AuditLogFilter } from "@/features/admin/components/audit-log-filter";
import { AuditLoadMore } from "@/features/admin/components/audit-load-more";
import {
  AUDIT_LOG_TYPES,
  fetchAdminProfileSSR,
  fetchAuditLogsSSR,
  type AuditLogType,
} from "@/features/admin/services/admin.server";

const PAGE_SIZE = 50;

function parseTypes(csv?: string): readonly AuditLogType[] {
  if (!csv) return [];
  const whitelist = new Set<string>(AUDIT_LOG_TYPES);
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => whitelist.has(s)) as AuditLogType[];
}

function parseOffset(raw?: string): number {
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Sprint 104: /admin/audit — tabela cards paginada de audit logs. Server
 * component; faz gate de role (UX apenas, AdminGuard backend é fonte da
 * verdade). Query `type` CSV whitelist, `offset` numérico. `data-sentry-mask`
 * no container — audit expõe userIds e metadata que podem indexar flows GDPR.
 * Ver ADR-0004.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; offset?: string }>;
}) {
  const t = await getTranslations("admin.audit");
  const profile = await fetchAdminProfileSSR();
  if (!profile) redirect("/login?returnUrl=%2Fadmin%2Faudit");
  if (!profile.roles.includes("admin")) redirect("/");

  const resolved = await searchParams;
  const types = parseTypes(resolved.type);
  const offset = parseOffset(resolved.offset);
  const { items, total } = await fetchAuditLogsSSR({
    limit: PAGE_SIZE,
    offset,
    types,
  });
  const shown = offset + items.length;
  const hasMore = shown < total;

  return (
    <main className="pb-16">
      <header className="sticky top-0 z-10 bg-cream px-4 py-3">
        <h1 className="font-display text-lg font-bold text-ink">
          {t("title")}
        </h1>
        <p className="text-xs text-muted">{t("subtitle", { total })}</p>
      </header>

      <section className="px-4 pt-3">
        <AuditLogFilter />
      </section>

      {items.length === 0 ? (
        <p className="px-4 pt-8 text-center text-sm text-muted">
          {t("empty")}
        </p>
      ) : (
        <section className="space-y-2 px-4 pt-4">
          {items.map((item) => (
            <AuditLogCard key={item.id} item={item} />
          ))}
          {hasMore && <AuditLoadMore nextOffset={shown} />}
          <p className="pt-2 text-center text-[11px] text-muted">
            {t("showing", { shown, total })}
          </p>
        </section>
      )}
    </main>
  );
}
