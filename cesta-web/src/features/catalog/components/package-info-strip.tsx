import { useTranslations } from "next-intl";
import { useLocale } from "@/hooks/use-locale";
import type { MeasureUnit } from "../types/catalog.types";
import { cn } from "@/lib/utils";

interface PackageInfoStripProps {
  packageSize: number;
  packageUnit: MeasureUnit;
  className?: string;
}

const UNIT_SUFFIX_ES: Record<MeasureUnit, string> = {
  LITER: "L",
  MILLILITER: "ml",
  KILOGRAM: "kg",
  GRAM: "g",
  UNIT: "ud",
};

// pt-BR usa as mesmas abreviações — sem bifurcar hoje.
const UNIT_SUFFIX_PT: Record<MeasureUnit, string> = UNIT_SUFFIX_ES;

/**
 * Sprint 152: strip visível no PDP mostrando tamanho + unidade (`1.5 L`,
 * `500 g`, `12 ud`). Dados vêm direto de `product.packageSize` +
 * `product.packageUnit` — já existem no schema.
 */
export function PackageInfoStrip({
  packageSize,
  packageUnit,
  className,
}: PackageInfoStripProps) {
  const locale = useLocale();
  const t = useTranslations("product");
  const suffixMap = locale === "pt-BR" ? UNIT_SUFFIX_PT : UNIT_SUFFIX_ES;
  const formatter = new Intl.NumberFormat(
    locale === "pt-BR" ? "pt-BR" : "es-ES",
    {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  );
  const sizeStr = formatter.format(packageSize);
  const suffix = suffixMap[packageUnit];

  return (
    <span
      data-sentry-unmask
      className={cn(
        "inline-flex items-center gap-1 rounded-pill bg-surface px-2.5 py-1 text-xs font-medium text-muted",
        className,
      )}
      aria-label={t("packageAria", { size: sizeStr, unit: suffix })}
    >
      <span>{sizeStr}</span>
      <span className="text-muted">{suffix}</span>
    </span>
  );
}
