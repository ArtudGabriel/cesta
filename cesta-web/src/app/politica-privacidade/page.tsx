import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return {
    title: `${t("title")} · Cesta`,
    description: t("sections.intro.body"),
    robots: { index: true, follow: false },
  };
}

export default async function PoliticaPrivacidadePage() {
  const t = await getTranslations("legal.privacy");

  const sectionKeys = [
    "intro",
    "controller",
    "dataCollected",
    "purpose",
    "legalBasis",
    "retention",
    "sharing",
    "cookies",
    "contact",
    "changes",
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

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-ink">
            {t("sections.rights.title")}
          </h2>
          <p className="text-sm leading-relaxed text-ink">
            {t("sections.rights.body")}
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-ink">
            <li>{t("sections.rights.access")}</li>
            <li>{t("sections.rights.portability")}</li>
            <li>{t("sections.rights.erasure")}</li>
            <li>{t("sections.rights.rectification")}</li>
            <li>{t("sections.rights.objection")}</li>
          </ul>
        </section>
      </div>

      <p className="mt-8 rounded-card bg-amber/15 p-3 text-xs text-amber">
        ⚠ {t("placeholder")}
      </p>
    </main>
  );
}
