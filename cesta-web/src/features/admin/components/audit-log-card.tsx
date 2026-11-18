"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditLogItem, AuditLogType } from "../services/admin.server";

const TYPE_COLOR: Record<AuditLogType, string> = {
  UserReactivated: "bg-mint/15 text-mint",
  UserDataExported: "bg-amber/15 text-amber",
  SecretRotated: "bg-violet/15 text-violet",
  AdminCancelledDelete: "bg-cesta-green/15 text-cesta-green",
  TwoFactorEnabled: "bg-mint/15 text-mint",
  TwoFactorDisabled: "bg-coral/15 text-coral",
  UserDataImported: "bg-amber/15 text-amber",
  UserReminderSent: "bg-lima/15 text-cesta-green-dark",
};

/**
 * Sprint 104: card compacto por audit entry. userId recebe
 * `data-sentry-mask` (PII); type badge + createdAt relative são chrome
 * público seguro. Metadata JSON colapsado por default (expand on click) —
 * payloads podem conter contagens / IDs técnicos; mantemos tudo dentro do
 * mask wrapper por precaução GDPR.
 */
export function AuditLogCard({ item }: { item: AuditLogItem }) {
  const t = useTranslations("admin.audit");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const hasMetadata =
    item.metadata !== null &&
    item.metadata !== undefined &&
    Object.keys(item.metadata as object).length > 0;

  return (
    <article
      data-sentry-mask
      className="rounded-card border border-border bg-white p-3 shadow-card"
    >
      <header className="flex items-start justify-between gap-2">
        <span
          data-sentry-unmask
          className={cn(
            "inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-semibold",
            TYPE_COLOR[item.type],
          )}
        >
          {t(`types.${item.type}`)}
        </span>
        <time
          data-sentry-unmask
          dateTime={item.createdAt}
          className="text-[11px] text-muted"
        >
          {format.relativeTime(new Date(item.createdAt), new Date())}
        </time>
      </header>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
        {item.userId && (
          <>
            <dt className="text-muted">{t("fields.userId")}</dt>
            <dd className="truncate font-mono text-ink">{item.userId}</dd>
          </>
        )}
        {item.actorId && item.actorId !== item.userId && (
          <>
            <dt className="text-muted">{t("fields.actorId")}</dt>
            <dd className="truncate font-mono text-ink">{item.actorId}</dd>
          </>
        )}
      </dl>

      {hasMetadata && (
        <>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:text-ink"
            aria-expanded={open}
          >
            {open ? (
              <>
                <ChevronUp className="h-3 w-3" aria-hidden />
                {t("metadata.hide")}
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" aria-hidden />
                {t("metadata.show")}
              </>
            )}
          </button>
          {open && (
            <pre className="mt-2 overflow-x-auto rounded-btn bg-surface p-2 text-[11px] font-mono text-ink">
              {JSON.stringify(item.metadata, null, 2)}
            </pre>
          )}
        </>
      )}
    </article>
  );
}
