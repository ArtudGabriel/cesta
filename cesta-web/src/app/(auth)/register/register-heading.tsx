"use client";

import { useTranslations } from "next-intl";

export function RegisterHeading() {
  const t = useTranslations("auth.register");
  return (
    <h2 className="mb-4 font-display text-xl font-bold text-ink">
      {t("title")}
    </h2>
  );
}
