"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { api, ApiError } from "@/lib/api";
import type { SoftDeletedUser } from "../services/admin.server";

interface CancelDeleteResponse {
  data: { status: "reactivated" | "already_active" };
}

/**
 * Sprint 95: card do admin pra cancelar soft-delete 1-click. Confirm
 * obrigatório (não é destrutivo mas é ação sensível) — reusa ConfirmDialog
 * já com focus trap + ARIA. `data-sentry-mask` por GDPR (email é PII).
 * router.refresh() força RSC re-render, pegando a lista atualizada.
 */
export function AdminUserCard({ user }: { user: SoftDeletedUser }) {
  const t = useTranslations("admin");
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirmCancel() {
    setPending(true);
    try {
      const res = await api.post<CancelDeleteResponse>(
        `/admin/users/${user.id}/cancel-delete`,
      );
      const status = res.data.data.status;
      toast.success(
        status === "reactivated"
          ? t("toast.reactivated")
          : t("toast.alreadyActive"),
      );
      setOpen(false);
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.message
          ? err.message
          : t("toast.error");
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="rounded-card bg-white p-4 shadow-sm">
      <p data-sentry-mask className="font-display text-sm font-bold text-ink">
        {user.email ?? "—"}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
        <div>
          <dt className="font-semibold uppercase tracking-wide">
            {t("card.deletedAt")}
          </dt>
          <dd>{format.dateTime(new Date(user.deletedAt), "short")}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide">
            {t("card.graceEndsAt")}
          </dt>
          <dd>
            {user.graceEndsAt
              ? format.dateTime(new Date(user.graceEndsAt), "short")
              : "—"}
          </dd>
        </div>
      </dl>
      <Button
        type="button"
        variant="primary"
        className="mt-3 min-h-11 w-full"
        onClick={() => setOpen(true)}
      >
        {t("card.cancelDelete")}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirmCancel}
        title={t("confirm.title")}
        body={t("confirm.body", { email: user.email ?? "—" })}
        confirmLabel={t("confirm.confirmLabel")}
        isPending={pending}
      />
    </article>
  );
}
