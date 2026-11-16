"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId } from "react";
import { Button } from "@/components/ui/button";

export type LoginGateAction = "review" | "favorite" | "alert" | "default";

interface LoginGateProps {
  open: boolean;
  onClose: () => void;
  /** Rota pra onde voltar após login. Default = window.location.pathname. */
  returnUrl?: string;
  /** Define a cópia do título. Default = "default" (genérico). */
  action?: LoginGateAction;
}

/**
 * Sprint 72: modal CTA mostrado quando user anônimo tenta ação logged-only
 * (review, favorite, alert). Substitui redirect hard pra /login, reduzindo
 * fricção ("ver preço" não exige login; "avaliar" sim, mas sem perder contexto).
 * Preserva `returnUrl` pra flow de login voltar à rota original.
 */
export function LoginGate({
  open,
  onClose,
  returnUrl,
  action = "default",
}: LoginGateProps) {
  const t = useTranslations("common.loginGate");
  const router = useRouter();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const title = t(`title.${action}`);
  const body = t(`body.${action}`);

  function goLogin() {
    const next =
      returnUrl ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
    router.push(`/login?returnUrl=${encodeURIComponent(next)}`);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-sentry-unmask
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-card bg-white p-5 shadow-card-elevated">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cesta-green/15 text-cesta-green">
            <LogIn className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p id={titleId} className="font-display text-base font-bold text-ink">
              {title}
            </p>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
          >
            {t("later")}
          </Button>
          <Button type="button" className="flex-1" onClick={goLogin}>
            {t("login")}
          </Button>
        </div>
      </div>
    </div>
  );
}
