"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ColdStartHintProps {
  /** Loading em curso. Timer começa quando flipa true; componente some em false. */
  active: boolean;
  /** Delay antes de mostrar o aviso. Default 3000ms. */
  delayMs?: number;
  className?: string;
}

/**
 * Sprint 71: Render free tier spin-down (~30s cold start) é percebido como
 * app travado. Este hint aparece após `delayMs` de loading ativo pra explicar
 * ao usuário por que a espera é maior que o normal. Não é interrompível por
 * design — some sozinho quando o fetch conclui (active → false).
 */
export function ColdStartHint({
  active,
  delayMs = 3000,
  className,
}: ColdStartHintProps) {
  const t = useTranslations("common");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const id = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(id);
  }, [active, delayMs]);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-sentry-unmask
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border/40 bg-surface px-4 py-3 text-sm text-muted",
        className,
      )}
    >
      <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" aria-hidden />
      <span>{t("coldStart")}</span>
    </div>
  );
}
