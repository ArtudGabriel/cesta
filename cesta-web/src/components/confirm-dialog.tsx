"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isPending?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
  isPending = false,
}: ConfirmDialogProps) {
  const t = useTranslations("common.confirm");
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // WAI-ARIA dialog pattern: salvar elemento focado antes da abertura e
    // restaurar no close pra devolver foco ao trigger. Captura em closure
    // garante restauração mesmo se DOM reorganizar durante o dialog aberto.
    const previousActive = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    // Scroll lock no body: previne scroll fantasma atrás do backdrop em
    // mobile/desktop. Preserva valor anterior em vez de assumir "" default,
    // caso o host aplique overflow custom (ex: HTML scroll via <html>).
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const first = cancelRef.current;
      const last = confirmRef.current;
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousActive?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={body ? bodyId : undefined}
      data-sentry-unmask
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-card bg-white p-5 shadow-card-elevated">
        <div className="flex items-start gap-3">
          <div
            className={
              destructive
                ? "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-coral/15 text-coral"
                : "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cesta-green/15 text-cesta-green"
            }
          >
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p
              id={titleId}
              className="font-display text-base font-bold text-ink"
            >
              {title}
            </p>
            {body && (
              <p id={bodyId} className="mt-1 text-sm text-muted">
                {body}
              </p>
            )}
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={isPending}
          >
            {cancelLabel ?? t("cancel")}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant={destructive ? "destructive" : "primary"}
            className="flex-1"
            onClick={onConfirm}
            disabled={isPending}
          >
            {confirmLabel ?? t("confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
