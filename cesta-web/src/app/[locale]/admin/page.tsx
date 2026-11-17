import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminUserCard } from "@/features/admin/components/admin-user-card";
import {
  fetchAdminProfileSSR,
  fetchSoftDeletedUsersSSR,
} from "@/features/admin/services/admin.server";

/**
 * Sprint 95: console administrativo — lista cuentas soft-deleted em grace
 * period 30d + ação 1-click pra cancelar via endpoint de S92. Server
 * component faz gate de role (`/users/me` → roles.includes("admin"); fora
 * disso `redirect("/")`). Backend `AdminGuard` é fonte da verdade (defense
 * in depth; essa gate só poupa round-trip e esconde UI).
 */
export default async function AdminPage() {
  const t = await getTranslations("admin");
  const profile = await fetchAdminProfileSSR();
  if (!profile) redirect("/login?returnUrl=%2Fadmin");
  if (!profile.roles.includes("admin")) redirect("/");

  const { items, total } = await fetchSoftDeletedUsersSSR();

  return (
    <main className="pb-16">
      <header className="sticky top-0 z-10 bg-cream px-4 py-3">
        <h1 className="font-display text-lg font-bold text-ink">
          {t("title")}
        </h1>
        <p className="text-xs text-muted">{t("subtitle", { total })}</p>
      </header>
      {items.length === 0 ? (
        <p className="px-4 pt-8 text-center text-sm text-muted">
          {t("empty")}
        </p>
      ) : (
        <section className="space-y-3 px-4 pt-4">
          {items.map((u) => (
            <AdminUserCard key={u.id} user={u} />
          ))}
        </section>
      )}
    </main>
  );
}
