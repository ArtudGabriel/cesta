"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMe, useResendVerification } from "@/features/auth/hooks/use-auth";
import { useAuthStore } from "@/stores/auth.store";

export function EmailVerificationBanner() {
  const t = useTranslations("auth.emailBanner");
  const user = useAuthStore((s) => s.user);
  const { data: me } = useMe();
  const resend = useResendVerification();
  const [dismissed, setDismissed] = useState(false);

  const current = me ?? user;
  if (!current || dismissed) return null;
  if (!current.email) return null;
  if (current.emailVerifiedAt) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-sentry-unmask
      className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <div className="mx-auto flex max-w-screen-sm items-start gap-3">
        <div className="flex-1">
          <p className="font-medium">{t("title")}</p>
          <p className="mt-0.5 text-amber-800">{t("body")}</p>
          <button
            type="button"
            className="mt-2 font-medium text-cesta-green hover:underline disabled:opacity-60"
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
          >
            {t("resend")}
          </button>
        </div>
        <button
          type="button"
          aria-label={t("dismiss")}
          className="shrink-0 rounded-full p-1 text-amber-700 hover:bg-amber-100"
          onClick={() => setDismissed(true)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
