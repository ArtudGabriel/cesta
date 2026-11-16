"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useMe, useResendVerification } from "@/features/auth/hooks/use-auth";
import { useAuthStore } from "@/stores/auth.store";

// Sprint 75 QA gate 4 (medium): banner dismiss persiste 24h via localStorage
// chaveado por userId. Após TTL, banner reaparece se user ainda unverified —
// evita nag constante sem esconder indefinidamente.
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;
const dismissKey = (userId: string) =>
  `cesta-email-banner-dismissed:${userId}`;

function readDismissed(userId: string): boolean {
  try {
    const raw = window.localStorage.getItem(dismissKey(userId));
    if (!raw) return false;
    const ts = Number(raw);
    if (Number.isNaN(ts)) return false;
    if (Date.now() - ts < DISMISS_TTL_MS) return true;
    window.localStorage.removeItem(dismissKey(userId));
    return false;
  } catch {
    return false;
  }
}

function writeDismissed(userId: string): void {
  try {
    window.localStorage.setItem(dismissKey(userId), String(Date.now()));
  } catch {
    // quota exceeded ou localStorage bloqueado — degrada pra in-memory
  }
}

export function EmailVerificationBanner() {
  const t = useTranslations("auth.emailBanner");
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const { data: me } = useMe();
  const resend = useResendVerification();

  // Sprint 75 QA gate 4 (high): render só após client mount + store hidratada.
  // Evita flash de strings na locale errada durante SSR → client handoff
  // (Zustand persist rehydra assincronamente; next-intl pode servir mensagem
  // da locale de inferência antes do cookie ser lido pelo RSC).
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  const current = me ?? user;
  const currentId = current?.id;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!currentId) return;
    setDismissed(readDismissed(currentId));
  }, [currentId]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    if (currentId) writeDismissed(currentId);
  }, [currentId]);

  if (!mounted || !isHydrated) return null;
  if (!current || !current.email) return null;
  if (current.emailVerifiedAt) return null;
  if (dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-sentry-unmask
      className="border-b border-amber/30 bg-amber/10 px-4 py-3 text-sm text-ink"
    >
      <div className="mx-auto flex max-w-screen-sm items-start gap-3">
        <div className="flex-1">
          <p className="font-medium text-amber">{t("title")}</p>
          <p className="mt-0.5 text-ink/80">{t("body")}</p>
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
          aria-label={t("closeAria")}
          className="shrink-0 rounded-full p-1 text-amber hover:bg-amber/20"
          onClick={handleDismiss}
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
