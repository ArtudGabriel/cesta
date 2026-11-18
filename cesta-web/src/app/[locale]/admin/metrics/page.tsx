import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MetricCard } from "@/features/admin/components/metric-card";
import {
  fetchAdminMetricsSSR,
  fetchAdminProfileSSR,
} from "@/features/admin/services/admin.server";

/**
 * Sprint 107: dashboard de métricas agregadas. Server component. Gate de
 * role (`/users/me` → roles.includes("admin")) espelha AdminGuard do backend
 * (defense in depth). Fetch SSR passa pelo endpoint cached 5min —
 * refresh manual = refresh de página.
 *
 * GDPR: payload é 100% agregado (COUNTs). Zero userIds/emails no DOM =
 * dispensa `data-sentry-mask`. Ver ADR-0007.
 */
export default async function AdminMetricsPage() {
  const t = await getTranslations("admin.metrics");
  const profile = await fetchAdminProfileSSR();
  if (!profile) redirect("/login?returnUrl=%2Fadmin%2Fmetrics");
  if (!profile.roles.includes("admin")) redirect("/");

  const metrics = await fetchAdminMetricsSSR();
  if (!metrics) redirect("/login?returnUrl=%2Fadmin%2Fmetrics");

  const nf = new Intl.NumberFormat();
  const alertsTotal =
    metrics.alertsActiveByType.simple +
    metrics.alertsActiveByType.combo +
    metrics.alertsActiveByType.trend +
    metrics.alertsActiveByType.bundle;

  return (
    <main className="pb-16" data-testid="admin-metrics-page">
      <header className="sticky top-0 z-10 bg-cream px-4 py-3">
        <h1 className="font-display text-lg font-bold text-ink">
          {t("title")}
        </h1>
        <p className="text-xs text-muted">
          {t("subtitle", {
            generatedAt: new Date(metrics.generatedAt).toLocaleString(),
          })}
          {metrics.cached ? ` · ${t("cachedBadge")}` : ""}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 px-4 pt-4">
        <MetricCard
          label={t("cards.usersTotal")}
          value={nf.format(metrics.usersTotal)}
        />
        <MetricCard
          label={t("cards.usersActive7d")}
          value={nf.format(metrics.usersActive7d)}
          caption={t("cards.usersActiveCaption")}
        />
        <MetricCard
          label={t("cards.alertsActive")}
          value={nf.format(alertsTotal)}
          caption={t("cards.alertsBreakdown", {
            simple: metrics.alertsActiveByType.simple,
            combo: metrics.alertsActiveByType.combo,
            trend: metrics.alertsActiveByType.trend,
            bundle: metrics.alertsActiveByType.bundle,
          })}
        />
        <MetricCard
          label={t("cards.receipts30d")}
          value={nf.format(metrics.receipts30d.parsed)}
          caption={t("cards.receiptsBreakdown", {
            failed: metrics.receipts30d.failed,
          })}
        />
        <MetricCard
          label={t("cards.pushNotifications7d")}
          value={nf.format(metrics.pushNotifications7d)}
        />
        <MetricCard
          label={t("cards.familyBaskets7d")}
          value={nf.format(metrics.familyBasketsGenerated7d)}
        />
      </section>
    </main>
  );
}
