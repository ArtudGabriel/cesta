"use client";

import { useTranslations } from "next-intl";

interface Props {
  step: number;
  total: number;
}

/**
 * Sprint 170 — progress bar visual + label "Paso N de M" acima da wizard
 * Cesta Familiar. Substitui apenas o chrome ao lado do breadcrumb textual
 * dos passos (que continua renderizado abaixo pra contexto nomeado).
 */
export function WizardStepIndicator({ step, total }: Props) {
  const t = useTranslations("familyBasket");
  const pct = Math.min(Math.max((step / total) * 100, 0), 100);
  return (
    <div
      className="space-y-1.5"
      data-testid="wizard-step-indicator"
      data-sentry-unmask
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide text-muted"
        data-testid="wizard-step-indicator-label"
      >
        {t("wizardProgressLabel", { step: String(step), total: String(total) })}
      </p>
      <div
        className="h-1.5 w-full overflow-hidden rounded-pill bg-neutral-200"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        <div
          className="h-full rounded-pill bg-cesta-green transition-all"
          style={{ width: `${pct}%` }}
          data-testid="wizard-step-indicator-fill"
        />
      </div>
    </div>
  );
}
