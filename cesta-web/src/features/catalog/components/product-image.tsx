"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Sprint 227 (#3 bundle): fallback visual explicito pra produto sem foto.
 * Antes: codigo usava `/placeholder.webp` que, dependendo do contexto,
 * ficava como skeleton infinito ou imagem muda. Agora exibe icone
 * ImageOff + label "Sin foto" / "Sem foto" (i18n catalog.noImage).
 * Trata 2 casos:
 *   (a) `src` null / vazio → renderiza fallback direto
 *   (b) `src` presente mas Image onError (host unlisted em remotePatterns,
 *       404, timeout) → swap pra fallback runtime via useState
 */
export interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
  showLabel?: boolean;
}

export function ProductImage({
  src,
  alt,
  width,
  height,
  priority,
  sizes,
  className,
  showLabel = true,
}: ProductImageProps) {
  const t = useTranslations("catalog");
  const [failed, setFailed] = useState(false);
  const hasSrc = Boolean(src && src.trim());

  if (!hasSrc || failed) {
    return (
      <div
        role="img"
        aria-label={t("noImage")}
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-surface text-muted",
          className,
        )}
        style={{ width, height }}
      >
        <ImageOff
          className="h-6 w-6 opacity-70"
          strokeWidth={1.5}
          aria-hidden
        />
        {showLabel && (
          <span className="text-[11px] font-medium leading-tight">
            {t("noImage")}
          </span>
        )}
      </div>
    );
  }

  return (
    <Image
      src={src!}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      sizes={sizes}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
