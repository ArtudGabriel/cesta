import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return {
    title: `${t("title")} · Cesta`,
    description: t("sections.acceptance.body"),
    robots: { index: true, follow: false },
  };
}

export default async function TermosPage() {
  const t = await getTranslations("legal.terms");

  const sectionKeys = [
    "acceptance",
    "service",
    "account",
    "acceptableUse",
    "intellectualProperty",
    "liability",
    "termination",
    "law",
  ] as const;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 pb-24">
      <h1 className="font-display text-3xl font-bold text-ink">{t("title")}</h1>
      <p className="mt-2 text-sm text-muted">
        {t("lastUpdated", { date: "2026-11-15" })}
      </p>

      <div className="mt-6 space-y-6">
        {sectionKeys.map((key) => (
          <section key={key} className="space-y-2">
            <h2 className="font-display text-lg font-bold text-ink">
              {t(`sections.${key}.title`)}
            </h2>
            <p className="text-sm leading-relaxed text-ink">
              {t(`sections.${key}.body`)}
            </p>
          </section>
        ))}
      </div>

      <p className="mt-8 rounded-card bg-amber/15 p-3 text-xs text-amber">
        ⚠ {t("placeholder")}
      </p>
    </main>
  );
}
