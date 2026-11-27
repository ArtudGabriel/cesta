"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Sprint 242 (#8) — badge visual de supermarket que substitui o texto cru
 * 'ME'/'AL'/'CA' de 2 letras por logo SVG. Comportamento:
 *   1. Tenta `/supermarkets/<slug>.svg` (asset estático em public/).
 *   2. onError (404, falha de rede) swap pro fallback: círculo colorido
 *      (DB color) com as 2 primeiras letras do nome em caps, mesmo visual
 *      do pré-S242 — não quebra layout quando o logo some.
 *
 * Os SVGs em `public/supermarkets/` são placeholders brand-colored com
 * iniciais (ADR 0043). Troca pro logo oficial é drop-in: mesmo filename,
 * mesmo viewBox 40x40, zero mudança de código.
 */

export interface SupermarketBadgeProps {
  slug: string;
  name: string;
  color?: string | null;
  size?: number;
  className?: string;
  /**
   * Força fallback (usado em testes jsdom onde requisição de asset
   * estática não dispara onError).
   */
  forceFallback?: boolean;
}

export function SupermarketBadge({
  slug,
  name,
  color,
  size = 40,
  className,
  forceFallback = false,
}: SupermarketBadgeProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = failed || forceFallback;
  const initials = name.slice(0, 2).toUpperCase();
  const dimensions = { width: size, height: size };

  if (showFallback) {
    return (
      <span
        role="img"
        aria-label={name}
        data-testid={`supermarket-badge-${slug}-fallback`}
        className={cn(
          "flex flex-shrink-0 items-center justify-center rounded-pill text-xs font-bold text-white",
          className,
        )}
        style={{
          ...dimensions,
          backgroundColor: color ?? "var(--color-cesta-green)",
        }}
      >
        {initials}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/supermarkets/${slug}.svg`}
      alt={name}
      data-testid={`supermarket-badge-${slug}`}
      className={cn("flex-shrink-0 rounded-pill", className)}
      style={dimensions}
      onError={() => setFailed(true)}
      // Logo é chrome público (nome visível do mercado), não PII.
      data-sentry-unmask=""
    />
  );
}
